import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fnv1a32, getBuildItemSlots, decodeBuildParam } from '../app/_src/utils/builder/buildUrlCodec.js';
import { minecraftAvatarUrl } from './minecraft-profile.js';

const DB_PATH = process.env.STS_DB_PATH || path.join(process.cwd(), 'data', 'sts-builds.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Longest build name we store. The builder's name input and the builds-page
// rename field cap at the same length so a name survives every save path.
export const BUILD_NAME_MAX = 50;

// The open handle, for server-side jobs that need to snapshot the database
// (see lib/db-backup.js). API code should keep using the functions below.
export function getDb() {
    return db;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    user_id TEXT,
    state TEXT,
    name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_builds_token ON builds (token);
`);

// Migrations for databases created before the ownership/state columns existed.
const migrateColumn = (name, ddl) => {
    try {
        db.exec(`ALTER TABLE builds ADD COLUMN ${ddl}`);
    } catch (e) {
        // "duplicate column name" is expected; anything else is not.
        if (!String(e.message).includes('duplicate column')) throw e;
    }
};
migrateColumn('user_id', 'user_id TEXT');
migrateColumn('state', 'state TEXT');
migrateColumn('name', 'name TEXT');
migrateColumn('notes', 'notes TEXT');
migrateColumn('updated_at', 'updated_at TEXT');
// Secret that lets the browser which created an anonymous build keep editing
// it in place. Never exposed to clients except as the httpOnly cookie.
migrateColumn('creator_token', 'creator_token TEXT');

// Public build database: visibility flags + author snapshot (taken at
// publicise time) + denormalized filter columns (computed from the token).
migrateColumn('is_public', 'is_public INTEGER NOT NULL DEFAULT 0');
migrateColumn('anonymous', 'anonymous INTEGER NOT NULL DEFAULT 0');
migrateColumn('author_name', 'author_name TEXT');
migrateColumn('author_avatar', 'author_avatar TEXT');
migrateColumn('class_name', 'class_name TEXT');
migrateColumn('spec', 'spec TEXT');
migrateColumn('region', 'region TEXT');
migrateColumn('power', 'power INTEGER NOT NULL DEFAULT 0');
migrateColumn('has_charms', 'has_charms INTEGER NOT NULL DEFAULT 0');
migrateColumn('masterwork_count', 'masterwork_count INTEGER NOT NULL DEFAULT 0');
migrateColumn('charm_count', 'charm_count INTEGER NOT NULL DEFAULT 0');
migrateColumn('ascension', 'ascension INTEGER NOT NULL DEFAULT 0');
migrateColumn('enhancement_count', 'enhancement_count INTEGER NOT NULL DEFAULT 0');
migrateColumn('skill_point_count', 'skill_point_count INTEGER NOT NULL DEFAULT 0');
migrateColumn('item_count', 'item_count INTEGER NOT NULL DEFAULT 0');
migrateColumn('skills_json', 'skills_json TEXT');
migrateColumn('items_json', 'items_json TEXT');
migrateColumn('cz_tree', 'cz_tree TEXT');
migrateColumn('publicized_at', 'publicized_at TEXT');
migrateColumn('source', 'source TEXT');
// Monotonic build revision: bumped on every real change, used as the short
// ?v= cache-buster on shared links (so the link only changes when the build
// does) and on embed image URLs.
migrateColumn('revision', 'revision INTEGER NOT NULL DEFAULT 1');

// Databases that predate the updated_at column have NULL for it on every row
// (the ALTER TABLE above couldn't backfill). Stamp a sensible value so the
// "My Builds" list never shows an invalid date.
db.prepare('UPDATE builds SET updated_at = created_at WHERE updated_at IS NULL').run();

db.exec('CREATE INDEX IF NOT EXISTS idx_builds_user ON builds (user_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_builds_public ON builds (is_public, updated_at);');
// Daily upload limit lookups count a user's builds in the last 24h.
db.exec('CREATE INDEX IF NOT EXISTS idx_builds_user_created ON builds (user_id, created_at);');

// Build names are unique per account (case-insensitive); different accounts
// may share a name. The API appends " (2)", " (3)", ... to duplicates before
// writing; this index makes the database enforce the per-account rule too
// (races, scripts, restores). Existing duplicates within an account are
// resolved by renaming the newer copies ("Name (2)") so the index can always
// be created. Anonymous builds (user_id NULL) are not scoped - SQLite treats
// their NULL owner as distinct, so they may share names.
try {
    db.exec('DROP INDEX IF EXISTS idx_builds_name');
    const duplicates = db
        .prepare(
            `SELECT user_id, name COLLATE NOCASE AS normalized FROM builds
             WHERE user_id IS NOT NULL AND name IS NOT NULL AND name != ''
             GROUP BY user_id, normalized HAVING COUNT(*) > 1`
        )
        .all();
    if (duplicates.length > 0) {
        const takenStmt = db.prepare("SELECT name FROM builds WHERE user_id = ? AND name IS NOT NULL AND name != ''");
        const rename = db.prepare('UPDATE builds SET name = ? WHERE id = ?');
        for (const { user_id, normalized } of duplicates) {
            const taken = new Set(takenStmt.all(user_id).map((row) => row.name.toLowerCase()));
            const rows = db
                .prepare(
                    `SELECT id, name FROM builds
                     WHERE user_id = ? AND name = ? COLLATE NOCASE
                     ORDER BY datetime(created_at) ASC, rowid ASC`
                )
                .all(user_id, normalized);
            for (const row of rows.slice(1)) {
                let attempt = 2;
                let next;
                do {
                    const suffix = ` (${attempt++})`;
                    next = row.name.slice(0, BUILD_NAME_MAX - suffix.length).trimEnd() + suffix;
                } while (taken.has(next.toLowerCase()));
                taken.add(next.toLowerCase());
                rename.run(next, row.id);
                console.warn(`[sts-builds] duplicate build name "${row.name}" renamed to "${next}"`);
            }
        }
    }
    db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_user_name ON builds (name COLLATE NOCASE, user_id)
         WHERE name IS NOT NULL AND name != ''`
    );
} catch (error) {
    console.error('[sts-builds] could not enforce unique build names:', error.message);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS build_favourites (
    build_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (build_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fav_user ON build_favourites (user_id);
`);

// Site announcements, posted by the site owner through the Discord bot
// (/notify). The bot is the only writer (see /api/v2/notifications); the
// public GET endpoint just reads these.
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    author TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// migrateColumn() is builds-only, so migrate the notifications table here.
try {
    db.exec("ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'info'");
} catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
}
// The type migration was once accidentally pointed at the builds table
// (migrateColumn hardcodes `ALTER TABLE builds`); drop that stray column.
try {
    db.exec('ALTER TABLE builds DROP COLUMN type');
} catch (e) {
    if (!String(e.message).includes('no such column')) throw e;
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ID_LENGTH = 8;

function randomId() {
    const bytes = crypto.randomBytes(ID_LENGTH);
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
        id += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return id;
}

// Canonical, stable serialization of the shareable build state so identical
// builds (including infusions + Revelation) always produce the same row.
// The state is client-supplied, so every collection is bounded: the stored
// blob may never grow past MAX_STATE_BYTES regardless of the request size.
const MAX_STATE_BYTES = 16384;
const MAX_INFUSION_ENTRIES = 100;
const MAX_BASIC_INFUSION_ENTRIES = 32;
const MAX_STATE_KEY_LENGTH = 64;
const MAX_STATE_VALUE_LENGTH = 64;

export function canonicalState(state) {
    if (!state || typeof state !== 'object') return null;
    const token = typeof state.token === 'string' ? state.token : '';
    if (!token) return null;
    const infusions = state.infusions && typeof state.infusions === 'object' ? state.infusions : {};
    const sortedInfusions = Object.fromEntries(
        Object.entries(infusions)
            .filter(
                ([key, v]) =>
                    typeof v === 'string' &&
                    v &&
                    v !== 'None' &&
                    key.length <= MAX_STATE_KEY_LENGTH &&
                    v.length <= MAX_STATE_VALUE_LENGTH
            )
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .slice(0, MAX_INFUSION_ENTRIES)
    );
    const canonical = { token, infusions: sortedInfusions, revelation: Boolean(state.revelation) };
    // Basic (normal) infusions per slot ({ slot: { name, level } }). Only
    // included when present so builds saved before this field existed keep
    // their exact canonical string (and don't fork on the next save).
    const basic = state.basicInfusions;
    if (basic && typeof basic === 'object') {
        const sortedBasic = Object.fromEntries(
            Object.entries(basic)
                .filter(([, v]) => v && typeof v.name === 'string' && v.name)
                .map(([slot, v]) => [
                    slot.slice(0, MAX_STATE_KEY_LENGTH),
                    {
                        name: v.name.slice(0, MAX_STATE_VALUE_LENGTH),
                        level: Math.max(1, Math.min(4, Number(v.level) || 1)),
                    },
                ])
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .slice(0, MAX_BASIC_INFUSION_ENTRIES)
        );
        if (Object.keys(sortedBasic).length > 0) {
            canonical.basicInfusions = sortedBasic;
        }
    }
    // Global (per-type) normal infusion levels entered as plain numbers. They
    // add to the per-slot infusions; only non-zero values are kept so builds
    // saved before this field existed keep their exact canonical string.
    const globals = state.globalInfusions;
    if (globals && typeof globals === 'object') {
        const cleaned = {};
        for (const key of ['tenacity', 'vitality', 'vigor', 'focus', 'perspicacity']) {
            const value = Math.floor(Number(globals[key]) || 0);
            if (value > 0) cleaned[key] = Math.min(24, value);
        }
        if (Object.keys(cleaned).length > 0) {
            canonical.globalInfusions = cleaned;
        }
    }
    const json = JSON.stringify(canonical);
    if (json.length > MAX_STATE_BYTES) return null;
    return json;
}

// Save a build. Identical state for the same owner reuses the existing row
// (so re-sharing an unchanged build never spawns a new link); identical state
// from a different owner (or anonymous) creates their own row so it can live
// on their "My Builds" list.
//
// Anonymous rows get a random creator_token; the creating browser receives it
// as an httpOnly cookie, which is the only way to keep editing that row in
// place (updateBuildState). Everyone else has to fork instead.
export function saveBuild({ state, userId, name, notes, summary, source = null, getCreatorToken = null }) {
    const canonical = canonicalState(state);
    if (!canonical) return null;

    const existing = userId
        ? db
              .prepare('SELECT id, name, notes, creator_token FROM builds WHERE state = ? AND user_id = ? LIMIT 1')
              .get(canonical, userId)
        : db
              .prepare('SELECT id, name, notes, creator_token FROM builds WHERE state = ? AND user_id IS NULL LIMIT 1')
              .get(canonical);
    if (existing) {
        // Anonymous rows are only editable in place by the browser holding the
        // row's creator token (same rule as updateBuildState). Anyone can
        // replay a shared state, but only the creator may rename the row.
        const ownsExisting = userId
            ? true
            : typeof getCreatorToken === 'function' &&
              existing.creator_token &&
              getCreatorToken(existing.id) === existing.creator_token;
        if (!ownsExisting) {
            return { id: existing.id, isNew: false };
        }
        // Same owner re-saving the identical build: keep the link, but let
        // name/notes ride along so they can be set on the first save. Only a
        // real change bumps the revision (the shared link stays stable).
        const nextName =
            name !== undefined ? (typeof name === 'string' && name ? name.slice(0, BUILD_NAME_MAX) : null) : undefined;
        const nextNotes =
            notes !== undefined ? (typeof notes === 'string' && notes ? notes.slice(0, 500) : null) : undefined;
        const changed =
            (nextName !== undefined && nextName !== existing.name) ||
            (nextNotes !== undefined && nextNotes !== existing.notes);
        if (changed) {
            const sets = [];
            const params = [];
            if (nextName !== undefined) {
                sets.push('name = ?');
                params.push(nextName);
            }
            if (nextNotes !== undefined) {
                sets.push('notes = ?');
                params.push(nextNotes);
            }
            db.prepare(`UPDATE builds SET ${sets.join(', ')}, revision = revision + 1 WHERE id = ?`).run(
                ...params,
                existing.id
            );
        }
        return { id: existing.id, isNew: false };
    }

    let id = randomId();
    for (let i = 0; i < 10; i++) {
        // Case-insensitive: lookups fall back to NOCASE for links shared with
        // the wrong casing, so two rows differing only by case would shadow
        // each other. Never mint such a pair.
        const exists = db.prepare('SELECT 1 FROM builds WHERE id = ? COLLATE NOCASE').get(id);
        if (!exists) break;
        id = randomId();
    }
    const creatorToken = userId ? null : crypto.randomBytes(16).toString('hex');
    db.prepare(
        "INSERT INTO builds (id, token, user_id, state, name, notes, creator_token, class_name, spec, region, power, has_charms, masterwork_count, charm_count, ascension, enhancement_count, skill_point_count, item_count, skills_json, items_json, cz_tree, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run(
        id,
        typeof state.token === 'string' ? state.token : '',
        userId || null,
        canonical,
        typeof name === 'string' && name ? name.slice(0, BUILD_NAME_MAX) : null,
        typeof notes === 'string' && notes ? String(notes).slice(0, 500) : null,
        creatorToken,
        summary?.class_name || null,
        summary?.spec || null,
        summary?.region || null,
        summary?.power || 0,
        summary?.has_charms || 0,
        summary?.masterwork_count || 0,
        summary?.charm_count || 0,
        summary?.ascension || 0,
        summary?.enhancement_count || 0,
        summary?.skill_point_count || 0,
        summary?.item_count || 0,
        summary?.skills_json || '[]',
        summary?.items_json || '[]',
        summary?.cz_tree || null,
        source || null
    );
    return { id, isNew: true, creatorToken };
}

// Some database exports carry a mangled "b1_" prefix on binary tokens
// (a corrupted "v1_"); the payload is a valid token, so restore the prefix.
// Unknown-but-unrelated strings are left untouched (they fail to decode
// downstream either way).
function healToken(token) {
    if (token && token.startsWith('b1_')) {
        return 'v1_' + token.slice(3);
    }
    return token;
}

const BUILD_ROW_SELECT =
    'SELECT id, token, user_id, state, name, notes, created_at, updated_at, revision, is_public, anonymous, author_name, author_avatar, class_name, spec, region, power, has_charms, masterwork_count, cz_tree, skills_json, items_json, publicized_at FROM builds WHERE id = ?';

export function getBuild(id) {
    if (!id || typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return null;
    // Exact match first, then a case-insensitive fallback for links shared with
    // the wrong casing. The fallback is deliberately second: two rows can
    // differ only by case (ids were generated case-sensitively until the
    // collision check below was fixed), and the exact link must open the exact
    // build instead of whichever row the insensitive scan finds first.
    const row = db.prepare(BUILD_ROW_SELECT).get(id) || db.prepare(`${BUILD_ROW_SELECT} COLLATE NOCASE`).get(id);
    if (!row) return null;
    let parsedState = null;
    if (row.state) {
        try {
            parsedState = JSON.parse(row.state);
        } catch (e) {
            parsedState = null;
        }
    }
    return { ...row, token: healToken(row.token), parsedState };
}

export function listBuildsByUser(userId) {
    if (!userId) return [];
    return db
        .prepare(
            'SELECT id, token, user_id, state, name, notes, created_at, updated_at, is_public, anonymous, author_name, author_avatar, class_name, spec, region, power, has_charms, masterwork_count, cz_tree, skills_json, items_json FROM builds WHERE user_id = ? ORDER BY updated_at DESC'
        )
        .all(userId)
        .map((row) => {
            let parsedState = null;
            if (row.state) {
                try {
                    parsedState = JSON.parse(row.state);
                } catch (e) {
                    parsedState = null;
                }
            }
            return { ...row, parsedState };
        });
}

// Update mutable metadata (name / notes) for an owned build.
export function updateBuild(id, userId, { name, notes } = {}) {
    if (!id || !userId) return false;
    const sets = [];
    const params = [];
    if (name !== undefined) {
        if (typeof name !== 'string') return false;
        sets.push('name = ?');
        params.push(String(name).slice(0, BUILD_NAME_MAX));
    }
    if (notes !== undefined) {
        if (typeof notes !== 'string') return false;
        sets.push('notes = ?');
        params.push(notes.slice(0, 500));
    }
    if (sets.length === 0) return false;
    const current = db.prepare('SELECT name, notes FROM builds WHERE id = ? AND user_id = ?').get(id, userId);
    if (!current) return false;
    // A rename/notes edit with identical values is a no-op: keep the revision
    // (and the shared link) unchanged.
    const sameName = name === undefined || current.name === String(name).slice(0, BUILD_NAME_MAX);
    const sameNotes = notes === undefined || current.notes === notes.slice(0, 500);
    if (sameName && sameNotes) return true;
    params.push(id, userId);
    const result = db
        .prepare(
            `UPDATE builds SET ${sets.join(', ')}, updated_at = datetime('now'), revision = revision + 1 WHERE id = ? AND user_id = ?`
        )
        .run(...params);
    return result.changes > 0;
}

// Update a build's full state (token + infusions + revelation) in place so
// editing a saved build keeps the same link. Allowed for the owner of an
// owned row, or for whoever holds the creator token of an anonymous row
// (the browser that created it). Everyone else must fork instead - otherwise
// anyone with a shared link could overwrite someone else's build.
export function updateBuildState(id, userId, creatorToken, { state, name, notes, summary } = {}) {
    if (!id) return false;
    const canonical = canonicalState(state);
    if (!canonical) return false;

    const sets = ['state = ?', 'token = ?'];
    const params = [canonical, typeof state.token === 'string' ? state.token : ''];
    if (summary) {
        sets.push(
            'class_name = ?',
            'spec = ?',
            'region = ?',
            'power = ?',
            'has_charms = ?',
            'masterwork_count = ?',
            'charm_count = ?',
            'ascension = ?',
            'enhancement_count = ?',
            'skill_point_count = ?',
            'item_count = ?',
            'skills_json = ?',
            'items_json = ?',
            'cz_tree = ?'
        );
        params.push(
            summary.class_name || null,
            summary.spec || null,
            summary.region || null,
            summary.power || 0,
            summary.has_charms || 0,
            summary.masterwork_count || 0,
            summary.charm_count || 0,
            summary.ascension || 0,
            summary.enhancement_count || 0,
            summary.skill_point_count || 0,
            summary.item_count || 0,
            summary.skills_json || '[]',
            summary.items_json || '[]',
            summary.cz_tree || null
        );
    }
    if (name !== undefined && name !== null) {
        if (typeof name !== 'string') return false;
        sets.push('name = ?');
        params.push(String(name).slice(0, BUILD_NAME_MAX));
    }
    if (notes !== undefined && notes !== null) {
        if (typeof notes !== 'string') return false;
        sets.push('notes = ?');
        params.push(notes.slice(0, 500));
    }
    // NULL never equals NULL in SQL, so a missing creatorToken just never matches.
    const current = db
        .prepare(
            'SELECT state, name, notes FROM builds WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))'
        )
        .get(id, userId || null, creatorToken || null);
    if (!current) return false;
    // Re-saving an unchanged build is a no-op: don't touch updated_at or the
    // revision, so the shared link stays the same.
    const nextName =
        name !== undefined ? (typeof name === 'string' && name ? name.slice(0, BUILD_NAME_MAX) : null) : current.name;
    const nextNotes =
        notes !== undefined ? (typeof notes === 'string' && notes ? notes.slice(0, 500) : null) : current.notes;
    const unchanged = current.state === canonical && current.name === nextName && current.notes === nextNotes;
    if (!unchanged) {
        params.push(id, userId || null, creatorToken || null);
        db.prepare(
            `UPDATE builds SET ${sets.join(', ')}, updated_at = datetime('now'), revision = revision + 1 WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))`
        ).run(...params);
    }
    // A logged-in user editing an anonymous row (matched by its creator token)
    // claims it: the row moves onto their account with the same link, so it
    // shows up on their "My Builds" list and future edits are owner-based.
    if (userId) {
        db.prepare('UPDATE builds SET user_id = ?, creator_token = NULL WHERE id = ? AND user_id IS NULL').run(
            userId,
            id
        );
    }
    return true;
}

export function deleteBuild(id, userId) {
    if (!id || !userId) return false;
    const result = db.prepare('DELETE FROM builds WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
}

// Build names are unique per account (case-insensitive): true when another
// build owned by the same user already carries this name. `excludeId` lets
// the build being re-saved / renamed keep its own name. Anonymous builds
// (no owner) are not scoped, so duplicates between them are allowed. Names
// are stored sliced to BUILD_NAME_MAX chars, so the comparison uses the same
// truncation.
export function buildNameTakenByUser(userId, name, excludeId) {
    if (!userId || typeof name !== 'string') return false;
    const clean = name.trim().slice(0, BUILD_NAME_MAX);
    if (!clean) return false;
    return Boolean(
        db
            .prepare('SELECT 1 FROM builds WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ? LIMIT 1')
            .get(userId, clean, excludeId || '')
    );
}

// The name to save: `name` unchanged when it is free for this account,
// otherwise with " (2)", " (3)", ... appended until it is. Anonymous saves
// (no owner) keep the name as-is.
export function uniqueBuildName(userId, name, excludeId = null) {
    if (typeof name !== 'string') return name;
    const clean = name.trim().slice(0, BUILD_NAME_MAX);
    if (!clean) return null;
    if (!userId || !buildNameTakenByUser(userId, clean, excludeId)) return clean;
    let attempt = 2;
    let next;
    do {
        const suffix = ` (${attempt++})`;
        next = clean.slice(0, BUILD_NAME_MAX - suffix.length).trimEnd() + suffix;
    } while (buildNameTakenByUser(userId, next, excludeId));
    return next;
}

// True when a write failed because another build already carries the name
// (the unique index backstop behind buildNameTakenByUser).
export function isDuplicateNameError(error) {
    return Boolean(error) && error.code === 'SQLITE_CONSTRAINT_UNIQUE' && String(error.message).includes('builds.name');
}

// The id of the saved build carrying exactly this state (if any), used to
// exclude the same build when it is re-saved with the same name. Anonymous
// lookups match the first unowned row with that state.
export function findBuildByState(userId, state) {
    const canonical = canonicalState(state);
    if (!canonical) return null;
    const row = userId
        ? db.prepare('SELECT id FROM builds WHERE state = ? AND user_id = ? LIMIT 1').get(canonical, userId)
        : db.prepare('SELECT id FROM builds WHERE state = ? AND user_id IS NULL LIMIT 1').get(canonical);
    return row ? row.id : null;
}

// Identity of the loadout a token describes: equipment, charm, class, spec,
// abilities and region. The name, the infusion stat inputs and site-only state
// (Revelation, global infusions, per-slot assignments) are left out on purpose
// - the mod can't send those, so a mod export must still recognise the build
// the site saved instead of piling up near-identical copies.
const SIGNATURE_KEYS = ['m', 'o', 'h', 'c', 'l', 'b', 'charm', 'cl', 'sk', 'sp', 'ssk', 'en', 'cz', 'region'];
const SIGNATURE_LIST_KEYS = new Set(['charm', 'sk', 'ssk', 'en', 'cz']);

export function buildContentSignature(token, itemData) {
    if (typeof token !== 'string' || !token) return null;
    const decoded = decodeBuildParam(token, itemData);
    if (!decoded || typeof decoded !== 'string') return null;
    try {
        const params = new URLSearchParams(decoded);
        return SIGNATURE_KEYS.map((key) => {
            let value = params.get(key) || '';
            // Ability lists are order-insensitive (the site and the mod build
            // them from independently ordered sources).
            if (value && SIGNATURE_LIST_KEYS.has(key)) value = value.split(',').sort().join(',');
            return `${key}=${value}`;
        }).join('&');
    } catch (e) {
        return null;
    }
}

// The account's build for this token, if it already exists. Prefers an exact
// token match, then a matching name, then the most recently updated row.
// Used by the mod upload path to update the existing build (and keep its link)
// rather than creating a duplicate.
export function findEquivalentBuild(userId, token, name, itemData) {
    if (!userId) return null;
    const target = buildContentSignature(token, itemData);
    if (!target) return null;
    let best = null;
    for (const row of listBuildsByUser(userId)) {
        if (buildContentSignature(row.token, itemData) !== target) continue;
        const score = (row.token === token ? 2 : 0) + (name && row.name === name ? 1 : 0);
        const when = row.updated_at || row.created_at || '';
        if (!best || score > best.score || (score === best.score && when > best.when)) {
            best = { row, score, when };
        }
    }
    return best ? best.row : null;
}

// SET clauses + params for a visibility change, shared by the owner flow
// (setBuildPublic) and the moderator toggle.
function buildPublicUpdate(isPublic, { anonymous, authorName, authorAvatar, summary } = {}) {
    const sets = ['is_public = ?', 'anonymous = ?'];
    const params = [isPublic ? 1 : 0, anonymous ? 1 : 0];
    if (isPublic) {
        if (authorName !== undefined) {
            sets.push('author_name = ?');
            params.push(typeof authorName === 'string' && authorName ? String(authorName).slice(0, 60) : null);
        }
        if (authorAvatar !== undefined) {
            sets.push('author_avatar = ?');
            params.push(typeof authorAvatar === 'string' ? authorAvatar : null);
        }
        if (summary) {
            sets.push(
                'class_name = ?',
                'spec = ?',
                'region = ?',
                'power = ?',
                'has_charms = ?',
                'masterwork_count = ?',
                'charm_count = ?',
                'ascension = ?',
                'enhancement_count = ?',
                'skill_point_count = ?',
                'item_count = ?',
                'skills_json = ?',
                'items_json = ?',
                'cz_tree = ?'
            );
            params.push(
                summary.class_name || null,
                summary.spec || null,
                summary.region || null,
                summary.power || 0,
                summary.has_charms || 0,
                summary.masterwork_count || 0,
                summary.charm_count || 0,
                summary.ascension || 0,
                summary.enhancement_count || 0,
                summary.skill_point_count || 0,
                summary.item_count || 0,
                summary.skills_json || '[]',
                summary.items_json || '[]',
                summary.cz_tree || null
            );
        }
        sets.push("publicized_at = datetime('now')");
    }
    return { sets, params };
}

// Flip a build's public visibility. Ownership is the same rule as
// updateBuildState: the signed-in owner of an owned row, or the holder of the
// creator token of an anonymous row. The author snapshot + derived filter
// columns are written when publicising (de-publicising only clears the flag).
export function setBuildPublic(
    id,
    userId,
    creatorToken,
    { isPublic, anonymous, authorName, authorAvatar, summary } = {}
) {
    if (!id) return false;
    const { sets, params } = buildPublicUpdate(isPublic, { anonymous, authorName, authorAvatar, summary });
    // NULL never equals NULL in SQL, so a missing creatorToken just never matches.
    const current = db
        .prepare(
            'SELECT is_public, anonymous, author_name, author_avatar FROM builds WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))'
        )
        .get(id, userId || null, creatorToken || null);
    if (!current) return false;
    // Only a real visibility / author change bumps the revision, so re-saving
    // the same public state keeps the shared link stable.
    const nextAuthorName = isPublic
        ? authorName !== undefined
            ? typeof authorName === 'string' && authorName
                ? String(authorName).slice(0, 60)
                : null
            : current.author_name
        : current.author_name;
    const nextAuthorAvatar = isPublic
        ? authorAvatar !== undefined
            ? typeof authorAvatar === 'string'
                ? authorAvatar
                : null
            : current.author_avatar
        : current.author_avatar;
    const changed =
        (current.is_public === 1) !== Boolean(isPublic) ||
        (current.anonymous === 1) !== Boolean(anonymous) ||
        current.author_name !== nextAuthorName ||
        current.author_avatar !== nextAuthorAvatar;
    if (changed) {
        params.push(id, userId || null, creatorToken || null);
        db.prepare(
            `UPDATE builds SET ${sets.join(', ')}, revision = revision + 1 WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))`
        ).run(...params);
    }
    // A logged-in user publicising / adjusting an anonymous row they created
    // claims it onto their account (same link), like updateBuildState does.
    if (userId) {
        db.prepare('UPDATE builds SET user_id = ?, creator_token = NULL WHERE id = ? AND user_id IS NULL').run(
            userId,
            id
        );
    }
    return true;
}

const PUBLIC_FIELDS =
    'id, token, user_id, name, notes, created_at, updated_at, is_public, anonymous, author_name, author_avatar, class_name, spec, region, power, has_charms, masterwork_count, charm_count, ascension, enhancement_count, skill_point_count, item_count, skills_json, items_json, cz_tree';

const escapeLike = (value) => '%' + String(value).replace(/[\\%_]/g, (m) => '\\' + m) + '%';

// Public database listing with favourites + filters. userId (optional) is the
// signed-in viewer, used for the my_favourite flag.
export function listPublicBuilds({
    class: className,
    region,
    spec,
    hasCharms,
    author,
    q,
    item,
    skill,
    sort = 'top',
    page = 1,
    limit = 24,
    userId = null,
} = {}) {
    const clauses = ['is_public = 1'];
    const params = [];
    if (className) {
        clauses.push('LOWER(class_name) = LOWER(?)');
        params.push(String(className));
    }
    if (region) {
        clauses.push('region = ?');
        params.push(String(region));
    }
    if (spec) {
        clauses.push('LOWER(spec) = LOWER(?)');
        params.push(String(spec));
    }
    if (hasCharms === '1' || hasCharms === 'true') {
        clauses.push('has_charms = 1');
    } else if (hasCharms === '0' || hasCharms === 'false') {
        clauses.push('has_charms = 0');
    }
    if (author) {
        clauses.push("author_name LIKE ? ESCAPE '\\'");
        params.push(escapeLike(author));
    }
    if (q) {
        clauses.push("name LIKE ? ESCAPE '\\'");
        params.push(escapeLike(q));
    }
    if (item) {
        clauses.push("items_json LIKE ? ESCAPE '\\'");
        params.push(escapeLike(item));
    }
    if (skill) {
        clauses.push("skills_json LIKE ? ESCAPE '\\'");
        params.push(escapeLike(skill));
    }
    const where = clauses.join(' AND ');

    const order =
        sort === 'power'
            ? 'b.power DESC, b.updated_at DESC'
            : sort === 'new'
              ? 'b.updated_at DESC'
              : 'fav_count DESC, b.updated_at DESC';
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 24));
    const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;

    const rows = db
        .prepare(
            `SELECT b.${PUBLIC_FIELDS},
                (SELECT COUNT(*) FROM build_favourites f WHERE f.build_id = b.id) AS fav_count,
                EXISTS(SELECT 1 FROM build_favourites mf WHERE mf.build_id = b.id AND mf.user_id = ?) AS my_fav
             FROM builds b
             WHERE ${where}
             ORDER BY ${order}
             LIMIT ${pageSize + 1} OFFSET ${offset}`
        )
        .all(userId, ...params);
    const hasMore = rows.length > pageSize;
    return { builds: rows.slice(0, pageSize), hasMore };
}

// The signed-in user's favourited builds (kept even if a build was later
// de-publicised - the link still works). `q` filters by build name (LIKE).
export function listFavouriteBuilds({ q = null, page = 1, limit = 24, userId = null } = {}) {
    if (!userId) return { builds: [], hasMore: false };
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 24));
    const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
    const favSelect = PUBLIC_FIELDS.split(', ')
        .map((c) => `b.${c}`)
        .join(', ');
    const clauses = ['bf.user_id = ?'];
    const params = [userId];
    if (q && typeof q === 'string') {
        const clean = q.trim().slice(0, 100);
        if (clean) {
            clauses.push("b.name LIKE ? ESCAPE '\\'");
            params.push(escapeLike(clean));
        }
    }
    const rows = db
        .prepare(
            `SELECT ${favSelect},
                (SELECT COUNT(*) FROM build_favourites f WHERE f.build_id = b.id) AS fav_count,
                1 AS my_fav
             FROM build_favourites bf
             JOIN builds b ON b.id = bf.build_id
             WHERE ${clauses.join(' AND ')}
             ORDER BY bf.created_at DESC
             LIMIT ${pageSize + 1} OFFSET ${offset}`
        )
        .all(...params);
    const hasMore = rows.length > pageSize;
    return { builds: rows.slice(0, pageSize), hasMore };
}

export function addFavourite(buildId, userId) {
    if (!buildId || !userId) return null;
    const row = db.prepare('SELECT is_public FROM builds WHERE id = ?').get(buildId);
    if (!row || row.is_public !== 1) return null;
    db.prepare('INSERT OR IGNORE INTO build_favourites (build_id, user_id) VALUES (?, ?)').run(buildId, userId);
    const count = db.prepare('SELECT COUNT(*) AS c FROM build_favourites WHERE build_id = ?').get(buildId).c;
    return { favourite: true, count };
}

export function removeFavourite(buildId, userId) {
    if (!buildId || !userId) return null;
    db.prepare('DELETE FROM build_favourites WHERE build_id = ? AND user_id = ?').run(buildId, userId);
    const count = db.prepare('SELECT COUNT(*) AS c FROM build_favourites WHERE build_id = ?').get(buildId).c;
    return { favourite: false, count };
}

export function getFavouriteState(buildId, userId) {
    const fav = userId
        ? db.prepare('SELECT 1 FROM build_favourites WHERE build_id = ? AND user_id = ?').get(buildId, userId)
        : null;
    const count = db.prepare('SELECT COUNT(*) AS c FROM build_favourites WHERE build_id = ?').get(buildId).c;
    return { favourite: Boolean(fav), count };
}

db.exec(`
  CREATE TABLE IF NOT EXISTS item_favourites (
    item_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (item_name, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_item_fav_user ON item_favourites (user_id);
`);

// Item favourites (base item names) for the signed-in user, in insertion
// order so the order is stable across requests. The builder pins these to
// the top of its item selectors.
export function listItemFavourites(userId) {
    if (!userId) return [];
    return db
        .prepare('SELECT item_name FROM item_favourites WHERE user_id = ? ORDER BY rowid ASC')
        .all(userId)
        .map((row) => row.item_name);
}

export function addItemFavourite(itemName, userId) {
    if (!itemName || !userId) return false;
    db.prepare('INSERT OR IGNORE INTO item_favourites (item_name, user_id) VALUES (?, ?)').run(
        String(itemName).slice(0, 200),
        userId
    );
    return true;
}

export function removeItemFavourite(itemName, userId) {
    if (!itemName || !userId) return false;
    db.prepare('DELETE FROM item_favourites WHERE item_name = ? AND user_id = ?').run(itemName, userId);
    return true;
}

// ---------------------------------------------------------------------------
// Custom items
//
// Created by logged-in players. Items are private to their creator for
// editing/deleting, but their share links are public read-only views; any
// logged-in visitor can duplicate an item into their own list through the
// regular create route (which stamps the copy with the viewer's account).
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS custom_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    texture_token TEXT,
    texture_name TEXT,
    stats_json TEXT NOT NULL,
    author_name TEXT,
    author_avatar TEXT,
    base_item TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_custom_items_user ON custom_items (user_id);
  CREATE INDEX IF NOT EXISTS idx_custom_items_user_created ON custom_items (user_id, created_at);
`);

// Older databases created the table before custom items carried a vanilla
// base item; add the column when missing (SQLite has no IF NOT EXISTS for
// ALTER TABLE ADD COLUMN).
try {
    db.prepare('SELECT base_item FROM custom_items LIMIT 1').get();
} catch (e) {
    db.exec('ALTER TABLE custom_items ADD COLUMN base_item TEXT');
}

// In-game uploads carry the exact per-stat display colors from the item's
// lore; stored as JSON like the stats.
try {
    db.prepare('SELECT stat_colors_json FROM custom_items LIMIT 1').get();
} catch (e) {
    db.exec('ALTER TABLE custom_items ADD COLUMN stat_colors_json TEXT');
}

// Custom item names are unique per account (same rule as builds): the API
// checks before saving, and this index makes the database enforce it too
// (races, scripts, restores). Existing duplicates within an account are
// renamed ("Name (2)") so the index can always be created.
try {
    const duplicates = db
        .prepare(
            `SELECT user_id, name COLLATE NOCASE AS normalized FROM custom_items
             WHERE name IS NOT NULL AND name != ''
             GROUP BY user_id, normalized HAVING COUNT(*) > 1`
        )
        .all();
    if (duplicates.length > 0) {
        const takenStmt = db.prepare('SELECT name FROM custom_items WHERE user_id = ?');
        const rename = db.prepare('UPDATE custom_items SET name = ? WHERE id = ?');
        for (const { user_id, normalized } of duplicates) {
            const taken = new Set(takenStmt.all(user_id).map((row) => row.name.toLowerCase()));
            const rows = db
                .prepare(
                    `SELECT id, name FROM custom_items
                     WHERE user_id = ? AND name = ? COLLATE NOCASE
                     ORDER BY datetime(created_at) ASC, rowid ASC`
                )
                .all(user_id, normalized);
            for (const row of rows.slice(1)) {
                let attempt = 2;
                let next;
                do {
                    const suffix = ` (${attempt++})`;
                    next = row.name.slice(0, BUILD_NAME_MAX - suffix.length).trimEnd() + suffix;
                } while (taken.has(next.toLowerCase()));
                taken.add(next.toLowerCase());
                rename.run(next, row.id);
                console.warn(`[sts-builds] duplicate custom item name "${row.name}" renamed to "${next}"`);
            }
        }
    }
    db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_items_user_name ON custom_items (name COLLATE NOCASE, user_id)
         WHERE name IS NOT NULL AND name != ''`
    );
} catch (error) {
    console.error('[sts-builds] could not enforce unique custom item names:', error.message);
}

export function saveCustomItem({
    userId,
    name,
    type,
    textureToken,
    textureName,
    stats,
    statColors = null,
    authorName,
    authorAvatar,
    baseItem = null,
}) {
    // Items uploaded from the game may have no site sprite; they render with
    // the vanilla base item texture instead.
    if (!userId || !name || (!textureToken && !baseItem)) return null;
    const id = randomId();
    try {
        db.prepare(
            `INSERT INTO custom_items (id, user_id, name, type, texture_token, texture_name, stats_json, stat_colors_json, author_name, author_avatar, base_item)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            id,
            userId,
            String(name).slice(0, BUILD_NAME_MAX),
            type,
            textureToken || null,
            textureName,
            JSON.stringify(stats || {}),
            statColors && Object.keys(statColors).length > 0 ? JSON.stringify(statColors) : null,
            authorName || null,
            authorAvatar || null,
            baseItem || null
        );
    } catch (error) {
        // Per-account unique names: a concurrent insert that lost the race is
        // reported as a failed save (the route pre-checks and returns 409).
        if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
        throw error;
    }
    return getCustomItem(id);
}

// How many custom items the account created in the last `minutes` minutes
// (used to rate-limit in-game uploads).
export function countRecentCustomItems(userId, minutes = 60) {
    if (!userId) return 0;
    return db
        .prepare("SELECT COUNT(*) AS c FROM custom_items WHERE user_id = ? AND created_at > datetime('now', ?)")
        .get(userId, `-${minutes} minutes`).c;
}

// True when the user already has a custom item with this name (case-
// insensitive). Duplicate names would silently overwrite each other in the
// builder's name-keyed item data, so new saves are blocked. The check is
// per-user: other accounts may freely use the same name. `excludeId` lets an
// item keep its own name while it is being edited.
export function hasCustomItemName(userId, name, excludeId) {
    if (!userId || !name) return false;
    const row = excludeId
        ? db
              .prepare('SELECT 1 FROM custom_items WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id != ? LIMIT 1')
              .get(userId, name, excludeId)
        : db
              .prepare('SELECT 1 FROM custom_items WHERE user_id = ? AND LOWER(name) = LOWER(?) LIMIT 1')
              .get(userId, name);
    return Boolean(row);
}

// Update an owned custom item's editable fields (name / type / texture /
// stats / base item). Returns the refreshed item, or null when nothing was
// changed.
export function updateCustomItem(id, userId, { name, type, textureToken, textureName, stats, baseItem } = {}) {
    if (!id || !userId) return null;
    const sets = [];
    const params = [];
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return null;
        sets.push('name = ?');
        params.push(name.trim().slice(0, BUILD_NAME_MAX));
    }
    if (type !== undefined) {
        sets.push('type = ?');
        params.push(type);
    }
    if (textureToken !== undefined) {
        sets.push('texture_token = ?');
        params.push(textureToken);
    }
    if (textureName !== undefined) {
        sets.push('texture_name = ?');
        params.push(textureName);
    }
    if (stats !== undefined) {
        sets.push('stats_json = ?');
        params.push(JSON.stringify(stats || {}));
    }
    if (baseItem !== undefined) {
        sets.push('base_item = ?');
        params.push(baseItem || null);
    }
    if (sets.length === 0) return null;
    params.push(id, userId);
    const result = db.prepare(`UPDATE custom_items SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    return result.changes > 0 ? getCustomItem(id) : null;
}

export function listCustomItems(userId) {
    if (!userId) return [];
    const rows = db
        .prepare('SELECT * FROM custom_items WHERE user_id = ? ORDER BY created_at DESC, id DESC')
        .all(userId);
    return rows.map(parseCustomItem);
}

export function getCustomItem(id) {
    if (!id) return null;
    const row = db.prepare('SELECT * FROM custom_items WHERE id = ?').get(id);
    return row ? parseCustomItem(row) : null;
}

export function deleteCustomItem(id, userId) {
    if (!id || !userId) return false;
    const result = db.prepare('DELETE FROM custom_items WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
}

// Public listings must not expose Discord account IDs: a bare avatar hash is
// turned into the full CDN URL server-side instead, so the client never needs
// the account id.
export function publicAuthorAvatar(userId, avatar) {
    if (!avatar || typeof avatar !== 'string') return null;
    if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
    return userId ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64` : null;
}

function parseCustomItem(row) {
    let stats = {};
    try {
        stats = JSON.parse(row.stats_json || '{}');
    } catch (e) {
        stats = {};
    }
    let statColors = null;
    try {
        statColors = row.stat_colors_json ? JSON.parse(row.stat_colors_json) : null;
    } catch (e) {
        statColors = null;
    }
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        type: row.type || 'Miscellaneous',
        textureToken: row.texture_token,
        textureName: row.texture_name || null,
        stats,
        statColors,
        authorName: row.author_name || null,
        authorAvatar: row.author_avatar || null,
        baseItem: row.base_item || null,
        createdAt: row.created_at,
    };
}

// Public custom items database: every player's items, newest first, filtered
// by name (LIKE) and/or exact item type. No auth needed - items are
// shareable, so the database is just the browseable view of the same links.
// `type` matches a single type; `types` matches any of a list (the API
// expands "All ..." filter tokens into their concrete types).
export function listPublicCustomItems({
    q = null,
    type = null,
    types = null,
    sort = 'top',
    page = 1,
    limit = 24,
} = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(60, Math.max(1, Number(limit) || 24));
    const offset = (safePage - 1) * safeLimit;

    const where = [];
    const params = [];
    if (q && typeof q === 'string') {
        const clean = q.trim().slice(0, 100);
        if (clean) {
            where.push('(LOWER(name) LIKE ?)');
            params.push(`%${clean.toLowerCase()}%`);
        }
    }
    const typeList = Array.isArray(types)
        ? types.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 32))
        : type && typeof type === 'string'
          ? [type.trim().slice(0, 32)]
          : [];
    if (typeList.length > 0) {
        where.push(`LOWER(type) IN (${typeList.map(() => '?').join(', ')})`);
        params.push(...typeList.map((t) => t.toLowerCase()));
    }
    const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';

    // 'top' = most favourited first, 'new' = newest first (same values as the
    // builds database).
    const order =
        sort === 'new'
            ? 'created_at DESC, id DESC'
            : '(SELECT COUNT(*) FROM custom_item_favourites f WHERE f.item_id = custom_items.id) DESC, created_at DESC, id DESC';
    const rows = db
        .prepare(`SELECT * FROM custom_items${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...params, safeLimit, offset);
    const total = db.prepare(`SELECT COUNT(*) AS count FROM custom_items${whereSql}`).get(...params).count;
    return {
        items: rows.map(parseCustomItem),
        hasMore: offset + rows.length < total,
        total,
    };
}

// Custom item likes. Items are shareable, so they can be liked by any
// signed-in visitor (including their owner, same as builds).
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_item_favourites (
    item_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (item_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_custom_item_fav_user ON custom_item_favourites (user_id);
`);

export function addCustomItemFavourite(itemId, userId) {
    if (!itemId || !userId) return null;
    const row = db.prepare('SELECT 1 FROM custom_items WHERE id = ?').get(itemId);
    if (!row) return null;
    db.prepare('INSERT OR IGNORE INTO custom_item_favourites (item_id, user_id) VALUES (?, ?)').run(itemId, userId);
    const count = db.prepare('SELECT COUNT(*) AS c FROM custom_item_favourites WHERE item_id = ?').get(itemId).c;
    return { favourite: true, count };
}

export function removeCustomItemFavourite(itemId, userId) {
    if (!itemId || !userId) return null;
    db.prepare('DELETE FROM custom_item_favourites WHERE item_id = ? AND user_id = ?').run(itemId, userId);
    const count = db.prepare('SELECT COUNT(*) AS c FROM custom_item_favourites WHERE item_id = ?').get(itemId).c;
    return { favourite: false, count };
}

export function getCustomItemFavouriteState(itemId, userId) {
    const fav = userId
        ? db.prepare('SELECT 1 FROM custom_item_favourites WHERE item_id = ? AND user_id = ?').get(itemId, userId)
        : null;
    const count = db.prepare('SELECT COUNT(*) AS c FROM custom_item_favourites WHERE item_id = ?').get(itemId).c;
    return { favourite: Boolean(fav), count };
}

// Favourite state for a list of items in one query (list cards). Returns a
// map keyed by item id: { count, favourite }.
export function customItemFavouriteStates(itemIds, userId = null) {
    const ids = [...new Set((itemIds || []).filter(Boolean))];
    const map = {};
    if (ids.length === 0) return map;
    const placeholders = ids.map(() => '?').join(', ');
    const counts = db
        .prepare(
            `SELECT item_id, COUNT(*) AS c FROM custom_item_favourites WHERE item_id IN (${placeholders}) GROUP BY item_id`
        )
        .all(...ids);
    for (const row of counts) map[row.item_id] = { count: row.c, favourite: false };
    if (userId) {
        const mine = db
            .prepare(`SELECT item_id FROM custom_item_favourites WHERE user_id = ? AND item_id IN (${placeholders})`)
            .all(userId, ...ids);
        for (const row of mine) {
            if (!map[row.item_id]) map[row.item_id] = { count: 0, favourite: false };
            map[row.item_id].favourite = true;
        }
    }
    return map;
}

// The signed-in user's liked custom items, most recently liked first.
// `q` filters by item name (LIKE, case-insensitive).
export function listFavouriteCustomItems({ q = null, page = 1, limit = 24, userId = null } = {}) {
    if (!userId) return { items: [], hasMore: false };
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 24));
    const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
    const clauses = ['cf.user_id = ?'];
    const params = [userId];
    if (q && typeof q === 'string') {
        const clean = q.trim().slice(0, 100);
        if (clean) {
            clauses.push('LOWER(ci.name) LIKE ?');
            params.push(`%${clean.toLowerCase()}%`);
        }
    }
    const rows = db
        .prepare(
            `SELECT ci.*,
                (SELECT COUNT(*) FROM custom_item_favourites f WHERE f.item_id = ci.id) AS fav_count
             FROM custom_item_favourites cf
             JOIN custom_items ci ON ci.id = cf.item_id
             WHERE ${clauses.join(' AND ')}
             ORDER BY cf.created_at DESC, cf.rowid DESC
             LIMIT ${pageSize + 1} OFFSET ${offset}`
        )
        .all(...params);
    const hasMore = rows.length > pageSize;
    return {
        items: rows.slice(0, pageSize).map((row) => ({ ...parseCustomItem(row), favouriteCount: row.fav_count })),
        hasMore,
    };
}

// Merges the user's custom items into the builder's item data so they can be
// equipped in the builder like normal items. The merge is per-user: only the
// owner's custom items are ever part of the item data, so a shared build
// containing a custom item renders that item only for its creator.
//
// Custom items are keyed by their name when the name is free, so builds
// saved before unique keys existed keep resolving. When a name is already
// taken by a base item (or, defensively, another custom item), the custom
// item gets a unique key (`custom-<id>`) instead - the two coexist and
// neither shadows the other. Selectors display the item's name either way.
export function mergeCustomItems(itemData, userId) {
    if (!userId || !itemData) return itemData;
    const customItems = listCustomItems(userId);
    if (customItems.length === 0) return itemData;
    const merged = { ...itemData };
    for (const custom of customItems) {
        const entry = {
            name: custom.name,
            type: custom.type,
            stats: custom.stats,
            statColors: custom.statColors,
            textureToken: custom.textureToken,
            // The builder's item tiles render the vanilla base item (and its
            // fallback texture) from `base_item`; null is fine for legacy
            // items that predate the field.
            base_item: custom.baseItem,
            isCustomItem: true,
        };
        const key = Object.prototype.hasOwnProperty.call(merged, custom.name) ? `custom-${custom.id}` : custom.name;
        merged[key] = entry;
    }
    return merged;
}

export function listAllCustomItems() {
    const rows = db.prepare('SELECT * FROM custom_items ORDER BY created_at DESC, id DESC').all();
    return rows.map(parseCustomItem);
}

// Custom items each build references, resolved from the token's equipment
// hashes (slot + texture included). This works even for builds saved before
// custom items were kept in items_json, so cards can render them regardless.
// One query for the whole page.
export function customItemsForBuilds(builds) {
    const rows = db.prepare('SELECT * FROM custom_items').all().map(parseCustomItem);
    if (rows.length === 0) return (builds || []).map(() => []);
    const byHash = new Map();
    for (const row of rows) {
        const hash = fnv1a32(row.name);
        if (!byHash.has(hash)) byHash.set(hash, []);
        byHash.get(hash).push(row);
    }
    return (builds || []).map((build) => {
        const slots = getBuildItemSlots(build.token);
        if (!slots || slots.length === 0) return [];
        const used = [];
        for (const { slot, hash } of slots) {
            const candidates = byHash.get(hash);
            if (!candidates) continue;
            // Same name can exist on several accounts: prefer the build owner's.
            const row = candidates.find((c) => c.userId === build.user_id) || candidates[0];
            if (used.some((item) => item.name === row.name && item.slot === slot)) continue;
            used.push({
                name: row.name,
                slot,
                textureToken: row.textureToken || null,
                baseItem: row.baseItem || null,
                type: row.type || null,
                // Stats ride along so the card's item detail can show them
                // without hitting the static items API (custom items aren't in it).
                stats: row.stats || {},
                statColors: row.statColors || null,
            });
        }
        return used;
    });
}

// Build-link variant of mergeCustomItems: the viewer's own items (all of
// them, as before) plus the public custom items the build token actually
// references, matched by the token's item-name hashes. That way shared builds
// render other players' custom items for everyone without dumping the whole
// public database into the builder's item pickers.
//
// Using custom items (in the builder or in a shared build) requires an
// account: anonymous visitors get the plain item data, while custom items
// stay viewable through the public database and share links.
export function mergeReferencedCustomItems(itemData, userId, referencedHashes) {
    if (!itemData || !userId) return itemData;
    const merged = { ...itemData };
    const usedNames = new Set();
    const add = (custom, allowBaseCollision) => {
        if (!custom.name || usedNames.has(custom.name)) return;
        if (!allowBaseCollision && Object.prototype.hasOwnProperty.call(itemData, custom.name)) return;
        usedNames.add(custom.name);
        const entry = {
            name: custom.name,
            type: custom.type,
            stats: custom.stats,
            statColors: custom.statColors,
            textureToken: custom.textureToken,
            base_item: custom.baseItem,
            isCustomItem: true,
        };
        const key = Object.prototype.hasOwnProperty.call(merged, custom.name) ? `custom-${custom.id}` : custom.name;
        merged[key] = entry;
    };
    for (const custom of listCustomItems(userId)) add(custom, true);
    if (Array.isArray(referencedHashes) && referencedHashes.length > 0) {
        const wanted = new Set(referencedHashes);
        for (const custom of listAllCustomItems()) {
            if (userId && custom.userId === userId) continue; // already added above
            if (!wanted.has(fnv1a32(custom.name))) continue;
            add(custom, false);
        }
    }
    return merged;
}

// Custom items a page has to merge into the client-fetched base item data:
// only the entries that aren't part of the static data, so the prop stays
// small no matter how big the item database is.
export function referencedCustomItemExtras(itemData, userId, referencedHashes) {
    const merged = mergeReferencedCustomItems(itemData, userId, referencedHashes);
    const extras = {};
    for (const key of Object.keys(merged)) {
        if (!Object.prototype.hasOwnProperty.call(itemData, key)) extras[key] = merged[key];
    }
    return extras;
}

// ---------- Minecraft account linking ----------
//
// A Minecraft UUID maps to exactly one Discord account. Linking happens out of
// band: the mod requests a pending link code, the player opens the resulting
// link in a browser, logs in with Discord and confirms. Pending codes expire
// after 15 minutes and only exist to prove the player ran the command in
// game - the actual link is recorded here.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS minecraft_links (
    uuid TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ml_discord ON minecraft_links (discord_id);

  CREATE TABLE IF NOT EXISTS pending_links (
    code TEXT PRIMARY KEY,
    uuid TEXT NOT NULL,
    token_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pl_uuid ON pending_links (uuid);
  `);

// Where the link request came from, shown on the confirmation page so the
// player can tell whether they started the flow themselves. Databases created
// before this column exist get it here.
try {
    db.exec('ALTER TABLE pending_links ADD COLUMN request_ip TEXT');
} catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
}

// Mod uploads are authenticated by a per-device token the mod generates and
// keeps locally; only its SHA-256 is stored here. The hash travels from the
// pending link to the confirmed link, so a public Minecraft UUID alone is no
// longer enough to write to an account.
for (const table of ['pending_links', 'minecraft_links']) {
    try {
        db.prepare(`SELECT token_hash FROM ${table} LIMIT 1`).get();
    } catch (e) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN token_hash TEXT`);
    }
}

// Discord profile snapshot for accounts seen since these columns existed;
// lets mod uploads (which have no Discord session) attribute created content
// to the Discord user instead of the Minecraft name.
for (const ddl of ['username TEXT', 'global_name TEXT', 'avatar TEXT', 'avatar_source TEXT']) {
    try {
        db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
    } catch (e) {
        if (!String(e.message).includes('duplicate column')) throw e;
    }
}

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// Records an STS account for a Discord user the first time they are seen
// (idempotent). "Account creation" is the first time their Discord identity
// touched the site, captured here because sessions themselves are stateless.
// When the Discord profile is passed along, it is snapshotted so mod uploads
// can show the Discord name/avatar instead of the Minecraft one.
export function ensureStsUser(discordId, profile = null) {
    if (typeof discordId !== 'string' || !discordId) return null;
    db.prepare('INSERT INTO users (discord_id) VALUES (?) ON CONFLICT(discord_id) DO NOTHING').run(discordId);
    if (profile && (profile.username || profile.globalName || profile.avatar)) {
        db.prepare(
            `UPDATE users SET
                username = COALESCE(?, username),
                global_name = COALESCE(?, global_name),
                avatar = COALESCE(?, avatar),
                updated_at = datetime('now')
             WHERE discord_id = ?`
        ).run(profile.username || null, profile.globalName || null, profile.avatar || null, discordId);
    }
    // A Discord rename or new picture changes who the published content belongs
    // to, but the author snapshot is only written when a build is
    // saved/publicised: without this refresh, every embed keeps showing the
    // identity from the last save. Runs on every login/session check so rows
    // written before this existed are repaired too.
    refreshAuthorSnapshots(discordId);
}

// Rewrites the author snapshot on everything the account has published (builds,
// custom items, saved sets) when it no longer matches the stored profile.
// Public builds also bump their revision - the OG image cache-buster - so the
// embed picks up the new identity instead of the picture Discord cached for
// the old one.
function refreshAuthorSnapshots(discordId) {
    const profile = getStsUserProfile(discordId);
    if (!profile) return;
    const name = profile.name;
    const avatar = profile.avatar;
    const stale = "(COALESCE(author_name, '') != ? OR COALESCE(author_avatar, '') != ?)";
    const staleParams = [name || '', avatar || ''];
    db.prepare(
        `UPDATE builds SET author_name = ?, author_avatar = ?, revision = revision + 1
         WHERE user_id = ? AND anonymous = 0 AND is_public = 1 AND ${stale}`
    ).run(name, avatar, discordId, ...staleParams);
    db.prepare(
        `UPDATE builds SET author_name = ?, author_avatar = ?
         WHERE user_id = ? AND anonymous = 0 AND is_public != 1 AND ${stale}`
    ).run(name, avatar, discordId, ...staleParams);
    db.prepare(`UPDATE custom_items SET author_name = ?, author_avatar = ? WHERE user_id = ? AND ${stale}`).run(
        name,
        avatar,
        discordId,
        ...staleParams
    );
    db.prepare(`UPDATE skill_sets SET author_name = ?, author_avatar = ? WHERE user_id = ? AND ${stale}`).run(
        name,
        avatar,
        discordId,
        ...staleParams
    );
}

// The Discord display name/avatar last seen for an account, used to attribute
// content uploaded from the game (where there is no Discord session).
export function getStsUserProfile(discordId) {
    if (typeof discordId !== 'string' || !discordId) return null;
    const row = db.prepare('SELECT username, global_name, avatar FROM users WHERE discord_id = ?').get(discordId);
    if (!row) return null;
    const name = row.global_name || row.username || null;
    const avatar = preferredAuthorAvatar(discordId, row.avatar || null);
    if (!name && !avatar) return null;
    return { name, avatar };
}

// The account's profile-picture preference: 'discord' (default), 'minecraft'
// (the cached head render of their first linked UUID), or 'upload:<id>' (an
// uploaded picture).
export function getAvatarSource(discordId) {
    if (typeof discordId !== 'string' || !discordId) return 'discord';
    const row = db.prepare('SELECT avatar_source FROM users WHERE discord_id = ?').get(discordId);
    const value = row ? row.avatar_source : null;
    if (value === 'minecraft') return 'minecraft';
    // Uploaded picture: "upload:<id>" (validated against the owner on write).
    if (typeof value === 'string' && value.startsWith('upload:')) return value;
    return 'discord';
}

// ---------------------------------------------------------------------------
// Moderation. Sanctions (bans/suspensions) are stored per Discord account;
// only the Discord IDs listed in STS_MODERATOR_IDS may manage them (enforced
// by lib/moderation.js in the API routes and the moderation page).
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS user_sanctions (
    discord_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    reason TEXT,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const SANCTION_KINDS = ['ban', 'suspend'];
export const SANCTION_REASON_MAX = 300;

// Accepts an ISO/datetime string (from the moderation UI) and returns the
// SQLite UTC format, or null when missing/invalid.
function toSqliteUtc(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

// The stored sanction for an account, expired suspensions included (the
// moderation page lists them so they can be lifted or renewed).
export function getSanction(discordId) {
    if (typeof discordId !== 'string' || !discordId) return null;
    return db.prepare('SELECT * FROM user_sanctions WHERE discord_id = ?').get(discordId) || null;
}

// The active sanction for an account, or null. Expired suspensions are
// cleared lazily, so a suspension lifts itself without a scheduler.
export function getActiveSanction(discordId) {
    if (typeof discordId !== 'string' || !discordId) return null;
    const row = db
        .prepare(
            `SELECT * FROM user_sanctions
             WHERE discord_id = ?
               AND (kind = 'ban' OR expires_at IS NULL OR expires_at > datetime('now'))`
        )
        .get(discordId);
    if (row) return row;
    db.prepare("DELETE FROM user_sanctions WHERE discord_id = ? AND kind = 'suspend'").run(discordId);
    return null;
}

// Creates or replaces an account's sanction. A suspension without an expiry
// behaves like a ban until it is lifted.
export function applySanction({ discordId, kind, reason = null, expiresAt = null, createdBy = null } = {}) {
    if (typeof discordId !== 'string' || !discordId) return null;
    if (!SANCTION_KINDS.includes(kind)) return null;
    const expires = kind === 'suspend' ? toSqliteUtc(expiresAt) : null;
    const cleanReason = reason ? String(reason).trim().slice(0, SANCTION_REASON_MAX) : null;
    db.prepare(
        `INSERT INTO user_sanctions (discord_id, kind, reason, expires_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(discord_id) DO UPDATE SET
            kind = excluded.kind,
            reason = excluded.reason,
            expires_at = excluded.expires_at,
            created_by = excluded.created_by,
            updated_at = datetime('now')`
    ).run(discordId, kind, cleanReason || null, expires, createdBy || null);
    return getSanction(discordId);
}

export function liftSanction(discordId) {
    if (typeof discordId !== 'string' || !discordId) return false;
    return db.prepare('DELETE FROM user_sanctions WHERE discord_id = ?').run(discordId).changes > 0;
}

// ---------------------------------------------------------------------------
// Moderation listings (moderator-only; the API routes enforce that).
// ---------------------------------------------------------------------------

// Accounts, newest activity first, with content counts and sanction state.
export function listModerationUsers({ query = '', limit = 50 } = {}) {
    const q = String(query || '').trim();
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return db
        .prepare(
            `SELECT u.discord_id AS id, u.username, u.global_name, u.created_at, u.updated_at,
                    (SELECT COUNT(*) FROM builds b WHERE b.user_id = u.discord_id) AS build_count,
                    (SELECT COUNT(*) FROM custom_items c WHERE c.user_id = u.discord_id) AS item_count,
                    s.kind AS sanction_kind, s.reason AS sanction_reason,
                    s.expires_at AS sanction_expires, s.created_at AS sanction_created,
                    s.created_by AS sanction_by
             FROM users u
             LEFT JOIN user_sanctions s ON s.discord_id = u.discord_id
             WHERE ? = ''
                OR u.discord_id LIKE ? ESCAPE '\\'
                OR LOWER(COALESCE(u.username, '')) LIKE LOWER(?) ESCAPE '\\'
                OR LOWER(COALESCE(u.global_name, '')) LIKE LOWER(?) ESCAPE '\\'
             ORDER BY u.updated_at DESC
             LIMIT ?`
        )
        .all(q, like, like, like, capped);
}

// One account's moderation detail: profile, links, content counts, sanction.
export function getModerationUser(discordId) {
    if (typeof discordId !== 'string' || !discordId) return null;
    const user = db
        .prepare('SELECT discord_id AS id, username, global_name, created_at, updated_at FROM users WHERE discord_id = ?')
        .get(discordId);
    if (!user) return null;
    return {
        ...user,
        sanction: getSanction(discordId),
        links: db
            .prepare('SELECT uuid, created_at, updated_at FROM minecraft_links WHERE discord_id = ?')
            .all(discordId),
        buildCount: db.prepare('SELECT COUNT(*) AS c FROM builds WHERE user_id = ?').get(discordId).c,
        itemCount: db.prepare('SELECT COUNT(*) AS c FROM custom_items WHERE user_id = ?').get(discordId).c,
    };
}

// Builds, newest first, searchable by id / name / owner id / author name.
export function listModerationBuilds({ query = '', limit = 50 } = {}) {
    const q = String(query || '').trim();
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return db
        .prepare(
            `SELECT id, name, user_id, is_public, anonymous, author_name, created_at, updated_at
             FROM builds
             WHERE ? = ''
                OR id LIKE ? ESCAPE '\\'
                OR user_id LIKE ? ESCAPE '\\'
                OR LOWER(COALESCE(name, '')) LIKE LOWER(?) ESCAPE '\\'
                OR LOWER(COALESCE(author_name, '')) LIKE LOWER(?) ESCAPE '\\'
             ORDER BY updated_at DESC
             LIMIT ?`
        )
        .all(q, like, like, like, like, capped);
}

// Removes any build regardless of owner (moderator action); its favourite
// rows go with it so no dangling entries stay on other accounts.
export function deleteBuildAsModerator(id) {
    if (typeof id !== 'string' || !id) return false;
    const result = db.prepare('DELETE FROM builds WHERE id = ?').run(id);
    if (result.changes > 0) {
        try {
            db.prepare('DELETE FROM build_favourites WHERE build_id = ?').run(id);
        } catch (e) {
            // favourites cleanup is best-effort
        }
    }
    return result.changes > 0;
}

// Moderation: force a build's public flag (and refresh its author snapshot /
// derived filters) without the ownership check the owner flow applies. Used
// by the moderation page's public/private toggle.
export function setBuildPublicAsModerator(id, isPublic, fields = {}) {
    if (typeof id !== 'string' || !id) return false;
    const current = db.prepare('SELECT is_public FROM builds WHERE id = ?').get(id);
    if (!current) return false;
    const { sets, params } = buildPublicUpdate(isPublic, fields);
    const changed = (current.is_public === 1) !== Boolean(isPublic);
    params.push(id);
    db.prepare(
        `UPDATE builds SET ${sets.join(', ')}${changed ? ', revision = revision + 1' : ''} WHERE id = ?`
    ).run(...params);
    return true;
}

// ---------------------------------------------------------------------------
// Uploaded profile pictures. Accounts can store up to MAX_UPLOADED_AVATARS
// custom pictures (on top of the Discord and Minecraft avatars); the bytes
// live in the database and are served from /api/v2/account/avatars/<id>.
// ---------------------------------------------------------------------------

export const MAX_UPLOADED_AVATARS = 3;

db.exec(`
  CREATE TABLE IF NOT EXISTS user_avatars (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_avatars_user ON user_avatars (user_id);
`);

export function uploadedAvatarUrl(id) {
    return id ? `/api/v2/account/avatars/${id}` : null;
}

export function listUserAvatars(userId) {
    if (!userId) return [];
    return db
        .prepare('SELECT id, mime, created_at FROM user_avatars WHERE user_id = ? ORDER BY created_at ASC, rowid ASC')
        .all(userId)
        .map((row) => ({ id: row.id, mime: row.mime, createdAt: row.created_at, url: uploadedAvatarUrl(row.id) }));
}

export function getUserAvatar(id) {
    if (!id || typeof id !== 'string') return null;
    return db.prepare('SELECT id, user_id, mime, data FROM user_avatars WHERE id = ?').get(id) || null;
}

export function countUserAvatars(userId) {
    if (!userId) return 0;
    return db.prepare('SELECT COUNT(*) AS c FROM user_avatars WHERE user_id = ?').get(userId).c;
}

export function saveUserAvatar(userId, mime, data) {
    if (!userId || !mime || !data) return null;
    if (countUserAvatars(userId) >= MAX_UPLOADED_AVATARS) return null;
    const id = randomId();
    db.prepare('INSERT INTO user_avatars (id, user_id, mime, data) VALUES (?, ?, ?, ?)').run(id, userId, mime, data);
    return { id, url: uploadedAvatarUrl(id) };
}

export function deleteUserAvatar(id, userId) {
    if (!id || !userId) return false;
    const row = db.prepare('SELECT id FROM user_avatars WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return false;
    db.prepare('DELETE FROM user_avatars WHERE id = ?').run(id);
    // Removing the active picture falls back to the Discord avatar.
    if (getAvatarSource(userId) === `upload:${id}`) setAvatarSource(userId, 'discord');
    return true;
}

// The avatar snapshot to store on the user's content: the cached Minecraft
// head URL when that is the preference (and a profile is linked), otherwise
// the Discord avatar hash. `discordAvatar` lets callers pass the fresh hash
// from a session that may not have been snapshotted yet.
export function preferredAuthorAvatar(discordId, discordAvatar = null) {
    if (typeof discordId !== 'string' || !discordId) return discordAvatar || null;
    const source = getAvatarSource(discordId);
    if (source.startsWith('upload:')) {
        const url = uploadedAvatarUrl(source.slice('upload:'.length));
        if (url) return url;
    }
    if (source === 'minecraft') {
        const link = db
            .prepare('SELECT uuid FROM minecraft_links WHERE discord_id = ? ORDER BY created_at ASC LIMIT 1')
            .get(discordId);
        const mc = link ? minecraftAvatarUrl(link.uuid) : null;
        if (mc) return mc;
    }
    if (discordAvatar) return discordAvatar;
    const row = db.prepare('SELECT avatar FROM users WHERE discord_id = ?').get(discordId);
    return (row && row.avatar) || null;
}

// Saves the profile-picture preference and refreshes the stored author
// snapshots so published content follows it immediately.
export function setAvatarSource(discordId, source) {
    if (typeof discordId !== 'string' || !discordId) return null;
    let next = 'discord';
    if (source === 'minecraft') {
        next = 'minecraft';
    } else if (typeof source === 'string' && source.startsWith('upload:')) {
        const id = source.slice('upload:'.length);
        const owned = db.prepare('SELECT 1 FROM user_avatars WHERE id = ? AND user_id = ?').get(id, discordId);
        if (!owned) return null;
        next = `upload:${id}`;
    }
    db.prepare("UPDATE users SET avatar_source = ?, updated_at = datetime('now') WHERE discord_id = ?").run(
        next,
        discordId
    );
    refreshAuthorSnapshots(discordId);
    return { avatarSource: next, avatar: preferredAuthorAvatar(discordId) };
}

// The STS account creation timestamp (UTC datetime string), or null when the
// user has no account row yet (e.g. a session from before users existed).
export function getStsUserCreatedAt(discordId) {
    if (typeof discordId !== 'string' || !discordId) return null;
    const row = db.prepare('SELECT created_at FROM users WHERE discord_id = ?').get(discordId);
    return row ? row.created_at : null;
}

// Normalizes a Minecraft UUID to the canonical dashed, lowercase form, or null
// when the input is not a valid UUID shape.
export function normalizeMinecraftUuid(uuid) {
    if (typeof uuid !== 'string' || !UUID_RE.test(uuid.trim())) return null;
    const bare = uuid.trim().replace(/-/g, '').toLowerCase();
    return `${bare.slice(0, 8)}-${bare.slice(8, 12)}-${bare.slice(12, 16)}-${bare.slice(16, 20)}-${bare.slice(20)}`;
}

// Creates (or refreshes) the pending-link code for a Minecraft UUID. The code
// is the secret: it is returned once, expires quickly, and is consumed on
// confirm. A new request invalidates any previous pending code for the UUID.
// `deviceToken` is the mod's locally generated secret (its hash is bound to
// the link on confirmation and required for every mod upload afterwards).
const DEVICE_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function hashDeviceToken(deviceToken) {
    return crypto.createHash('sha256').update(deviceToken, 'utf8').digest('hex');
}

export function createPendingLink(uuid, deviceToken, requestIp = null) {
    const normalized = normalizeMinecraftUuid(uuid);
    if (!normalized) return null;
    if (typeof deviceToken !== 'string' || !DEVICE_TOKEN_RE.test(deviceToken)) return null;
    const code = crypto.randomBytes(9).toString('base64url');
    // Codes are short-lived; drop expired rows so the table cannot grow
    // without bound (this endpoint is unauthenticated).
    db.prepare("DELETE FROM pending_links WHERE created_at < datetime('now', '-15 minutes')").run();
    db.prepare('DELETE FROM pending_links WHERE uuid = ?').run(normalized);
    db.prepare('INSERT INTO pending_links (code, uuid, token_hash, request_ip) VALUES (?, ?, ?, ?)').run(
        code,
        normalized,
        hashDeviceToken(deviceToken),
        typeof requestIp === 'string' && requestIp ? requestIp.slice(0, 64) : null
    );
    return code;
}

// Resolves a pending link code to its UUID, or null when unknown/expired.
export function getPendingLink(code) {
    if (typeof code !== 'string' || !code) return null;
    return (
        db
            .prepare(
                "SELECT code, uuid, token_hash, request_ip, created_at FROM pending_links WHERE code = ? AND created_at > datetime('now', '-15 minutes')"
            )
            .get(code) || null
    );
}

// Binds a pending code to the signed-in Discord account. Returns:
//   { ok: true, uuid }                      - linked
//   { error: 'expired' }                    - code unknown or expired
//   { error: 'linked-elsewhere' }           - uuid already belongs to another
//                                             account; the player must unlink
//                                             it on the site first
//   { error: 'replace-required', ... }      - uuid is linked to this same
//                                             account by a *different* device.
//                                             Rebinding needs an explicit
//                                             replace so a link someone else
//                                             minted cannot silently take over
//                                             the authorized game device.
export function confirmPendingLink(code, discordId, { replace = false } = {}) {
    if (!discordId) return { error: 'expired' };
    const pending = getPendingLink(code);
    if (!pending) return { error: 'expired' };
    const existing = db.prepare('SELECT discord_id, token_hash FROM minecraft_links WHERE uuid = ?').get(pending.uuid);
    if (existing && existing.discord_id !== discordId) {
        return { error: 'linked-elsewhere' };
    }
    if (
        existing &&
        existing.token_hash &&
        pending.token_hash &&
        existing.token_hash !== pending.token_hash &&
        !replace
    ) {
        return {
            error: 'replace-required',
            uuid: pending.uuid,
            requestedFrom: pending.request_ip || null,
            requestedAt: pending.created_at || null,
        };
    }
    db.prepare(
        "INSERT INTO minecraft_links (uuid, discord_id, token_hash, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(uuid) DO UPDATE SET discord_id = excluded.discord_id, token_hash = excluded.token_hash, updated_at = excluded.updated_at"
    ).run(pending.uuid, discordId, pending.token_hash || null);
    db.prepare('DELETE FROM pending_links WHERE code = ?').run(code);
    return { ok: true, uuid: pending.uuid };
}

export function getLinkByUuid(uuid) {
    const normalized = normalizeMinecraftUuid(uuid);
    if (!normalized) return null;
    const row = db
        .prepare('SELECT uuid, discord_id, token_hash, created_at, updated_at FROM minecraft_links WHERE uuid = ?')
        .get(normalized);
    return row || null;
}

// True when the presented device token matches the link's stored hash. Used by
// the mod upload routes: knowing a linked UUID is not enough.
export function verifyModToken(uuid, deviceToken) {
    if (typeof deviceToken !== 'string' || !deviceToken) return false;
    const link = getLinkByUuid(uuid);
    if (!link || !link.token_hash) return false;
    const presented = Buffer.from(hashDeviceToken(deviceToken), 'utf8');
    const stored = Buffer.from(link.token_hash, 'utf8');
    return presented.length === stored.length && crypto.timingSafeEqual(presented, stored);
}

export function listLinksForDiscord(discordId) {
    if (!discordId) return [];
    return db
        .prepare('SELECT uuid, discord_id, created_at, updated_at FROM minecraft_links WHERE discord_id = ?')
        .all(discordId);
}

export function unlinkMinecraftUuid(uuid, discordId) {
    if (!uuid || !discordId) return false;
    const result = db.prepare('DELETE FROM minecraft_links WHERE uuid = ? AND discord_id = ?').run(uuid, discordId);
    return result.changes > 0;
}

// How many builds the mod saved for an account in the last `minutes` minutes.
// Used to keep a leaked UUID from flooding a profile with junk builds.
export function countRecentModSaves(discordId, minutes = 60) {
    if (!discordId) return 0;
    return db
        .prepare(
            "SELECT COUNT(*) AS c FROM builds WHERE user_id = ? AND source = 'mod' AND created_at > datetime('now', ?)"
        )
        .get(discordId, `-${minutes} minutes`).c;
}

// How many builds an account created in the last `minutes` minutes, from any
// source. Used for the daily upload limit (site saves and mod saves share it).
export function countRecentBuilds(userId, minutes = 24 * 60) {
    if (!userId) return 0;
    return db
        .prepare("SELECT COUNT(*) AS c FROM builds WHERE user_id = ? AND created_at > datetime('now', ?)")
        .get(userId, `-${minutes} minutes`).c;
}

// --- Site announcements (posted via the Discord bot's /notify) ---

export const NOTIFICATION_TYPES = ['info', 'warning', 'error'];

export function listNotifications(limit = 5) {
    return db
        .prepare('SELECT id, message, author, type, created_at FROM notifications ORDER BY id DESC LIMIT ?')
        .all(limit);
}

export function createNotification(message, author = null, type = 'info') {
    const text = String(message || '').trim();
    if (!text) return null;
    const safeType = NOTIFICATION_TYPES.includes(type) ? type : 'info';
    const info = db
        .prepare('INSERT INTO notifications (message, author, type) VALUES (?, ?, ?)')
        .run(text.slice(0, 500), author, safeType);
    return db
        .prepare('SELECT id, message, author, type, created_at FROM notifications WHERE id = ?')
        .get(info.lastInsertRowid);
}

export function deleteNotification(id) {
    const info = db.prepare('DELETE FROM notifications WHERE id = ?').run(Number(id));
    return info.changes > 0;
}

// --- Account deletion ---
//
// Removes everything that identifies the user. Their saved builds are NOT
// deleted - the share links keep working - but they leave the public
// database and lose their user association (is_public = 0, user_id NULL,
// author snapshot cleared). Favourites, custom items, Minecraft links,
// uploaded profile pictures and the stored Discord profile are deleted.
export function deleteUserData(userId) {
    if (!userId) return false;
    db.prepare(
        'UPDATE builds SET is_public = 0, user_id = NULL, anonymous = 1, author_name = NULL, author_avatar = NULL WHERE user_id = ?'
    ).run(userId);
    db.prepare('DELETE FROM build_favourites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM item_favourites WHERE user_id = ?').run(userId);
    db.prepare(
        `DELETE FROM custom_item_favourites
         WHERE user_id = ?
            OR item_id IN (SELECT id FROM custom_items WHERE user_id = ?)`
    ).run(userId, userId);
    db.prepare('DELETE FROM custom_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM minecraft_links WHERE discord_id = ?').run(userId);
    db.prepare('DELETE FROM skill_sets WHERE user_id = ?').run(userId);
    // Uploaded profile pictures are personal data: they must not stay in the
    // database (or remain publicly fetchable) after the account is deleted.
    db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE discord_id = ?').run(userId);
    return true;
}

// --- Saved skill / delve / stat sets ---
//
// Logged-in users can snapshot the skill portion of a build (class, spec,
// skill points, enhancements, CZ abilities - kind 'skills'), the delve
// infusions (kind 'delve'), or the stat rows of a custom item (kind 'stats')
// and re-apply them later. The payload is owned entirely by the client; the
// server just stores it.
db.exec(`
  CREATE TABLE IF NOT EXISTS skill_sets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    class_name TEXT,
    spec TEXT,
    is_public INTEGER NOT NULL DEFAULT 0,
    author_name TEXT,
    author_avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_skill_sets_user ON skill_sets (user_id, kind);
`);

// API URLs are versioned (/api/v2/...): author-avatar snapshots stored before
// the v2 bump still point at the old /api/v1 paths, so rewrite them in place.
for (const table of ['builds', 'custom_items', 'skill_sets']) {
    try {
        db.prepare(
            `UPDATE ${table} SET author_avatar = replace(author_avatar, '/api/v1/', '/api/v2/') WHERE author_avatar LIKE '/api/v1/%'`
        ).run();
    } catch (e) {
        // Table may not exist yet on very old databases; created above on load.
    }
}

// Sharing columns for databases created before public set links existed.
const migrateSkillSetColumn = (ddl) => {
    try {
        db.exec(`ALTER TABLE skill_sets ADD COLUMN ${ddl}`);
    } catch (e) {
        if (!String(e.message).includes('duplicate column')) throw e;
    }
};
migrateSkillSetColumn('is_public INTEGER NOT NULL DEFAULT 0');
migrateSkillSetColumn('author_name TEXT');
migrateSkillSetColumn('author_avatar TEXT');

export const SKILL_SET_KINDS = ['skills', 'delve', 'stats'];
export const SKILL_SET_NAME_MAX = 40;

export function listSkillSetsByUser(userId, kind = null) {
    if (!userId) return [];
    const rows =
        kind && SKILL_SET_KINDS.includes(kind)
            ? db
                  .prepare('SELECT * FROM skill_sets WHERE user_id = ? AND kind = ? ORDER BY updated_at DESC')
                  .all(userId, kind)
            : db.prepare('SELECT * FROM skill_sets WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    return rows.map((row) => ({ ...row, isPublic: row.is_public === 1, payload: safeJson(row.payload) }));
}

// Creates a set unless the owner already has one with the same (case
// insensitive) name for that kind. Returns { id, isNew } - duplicate saves
// reuse the existing row so the name stays unique per kind.
export function saveSkillSet({ userId, kind, name, payload, className = null, spec = null }) {
    if (!userId || !SKILL_SET_KINDS.includes(kind) || typeof payload !== 'string') return null;
    const cleanName = String(name || '')
        .trim()
        .slice(0, SKILL_SET_NAME_MAX);
    if (!cleanName) return null;
    const existing = db
        .prepare('SELECT id FROM skill_sets WHERE user_id = ? AND kind = ? AND name = ? COLLATE NOCASE')
        .get(userId, kind, cleanName);
    if (existing) {
        db.prepare(
            "UPDATE skill_sets SET payload = ?, class_name = ?, spec = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(payload, className, spec, existing.id);
        return { id: existing.id, isNew: false };
    }
    let id = randomId();
    for (let i = 0; i < 10; i++) {
        const exists = db.prepare('SELECT 1 FROM skill_sets WHERE id = ?').get(id);
        if (!exists) break;
        id = randomId();
    }
    db.prepare(
        "INSERT INTO skill_sets (id, user_id, kind, name, payload, class_name, spec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run(id, userId, kind, cleanName, payload, className, spec);
    return { id, isNew: true };
}

export function deleteSkillSet(id, userId) {
    if (!id || !userId || typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return false;
    return db.prepare('DELETE FROM skill_sets WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

// Starts/stops sharing one of the caller's sets. The author snapshot is
// taken when sharing starts (like builds' publicise step), so the embed
// keeps a name/avatar even if the Discord profile changes later.
export function setSkillSetPublic({ id, userId, isPublic, authorName = null, authorAvatar = null }) {
    if (!id || !userId || typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return false;
    const result = isPublic
        ? db
              .prepare(
                  'UPDATE skill_sets SET is_public = 1, author_name = COALESCE(?, author_name), author_avatar = COALESCE(?, author_avatar) WHERE id = ? AND user_id = ?'
              )
              .run(authorName, authorAvatar, id, userId)
        : db.prepare('UPDATE skill_sets SET is_public = 0 WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
}

// A shared set for its builder link (/builder?set=<id>) and embed. Only rows
// the owner has shared are visible; unsharing makes the link stop applying
// the set immediately.
export function getPublicSkillSet(id) {
    if (!id || typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return null;
    const row = db.prepare('SELECT * FROM skill_sets WHERE id = ? AND is_public = 1').get(id);
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        kind: row.kind,
        name: row.name,
        className: row.class_name,
        spec: row.spec,
        payload: safeJson(row.payload),
        authorName: row.author_name,
        authorAvatar: row.author_avatar,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function safeJson(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}
