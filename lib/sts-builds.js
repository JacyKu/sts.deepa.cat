import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';

const DB_PATH = process.env.STS_DB_PATH || path.join(process.cwd(), 'data', 'sts-builds.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

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

// Databases that predate the updated_at column have NULL for it on every row
// (the ALTER TABLE above couldn't backfill). Stamp a sensible value so the
// "My Builds" list never shows an invalid date.
db.prepare('UPDATE builds SET updated_at = created_at WHERE updated_at IS NULL').run();

db.exec('CREATE INDEX IF NOT EXISTS idx_builds_user ON builds (user_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_builds_public ON builds (is_public, updated_at);');

db.exec(`
  CREATE TABLE IF NOT EXISTS build_favourites (
    build_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (build_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fav_user ON build_favourites (user_id);
`);

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
export function canonicalState(state) {
    if (!state || typeof state !== 'object') return null;
    const token = typeof state.token === 'string' ? state.token : '';
    if (!token) return null;
    const infusions = state.infusions || {};
    const sortedInfusions = Object.fromEntries(
        Object.entries(infusions)
            .filter(([, v]) => v && v !== 'None')
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );
    return JSON.stringify({ token, infusions: sortedInfusions, revelation: Boolean(state.revelation) });
}

// Save a build. Identical state for the same owner reuses the existing row
// (so re-sharing an unchanged build never spawns a new link); identical state
// from a different owner (or anonymous) creates their own row so it can live
// on their "My Builds" list.
//
// Anonymous rows get a random creator_token; the creating browser receives it
// as an httpOnly cookie, which is the only way to keep editing that row in
// place (updateBuildState). Everyone else has to fork instead.
export function saveBuild({ state, userId, name, notes, summary }) {
    const canonical = canonicalState(state);
    if (!canonical) return null;

    const existing = userId
        ? db.prepare('SELECT id FROM builds WHERE state = ? AND user_id = ? LIMIT 1').get(canonical, userId)
        : db.prepare('SELECT id FROM builds WHERE state = ? AND user_id IS NULL LIMIT 1').get(canonical);
    if (existing) {
        // Same owner re-saving the identical build: keep the link, but let
        // name/notes ride along so they can be set on the first save.
        if (name !== undefined || notes !== undefined) {
            const sets = [];
            const params = [];
            if (name !== undefined) {
                sets.push('name = ?');
                params.push(typeof name === 'string' ? name.slice(0, 100) : null);
            }
            if (notes !== undefined) {
                sets.push('notes = ?');
                params.push(typeof notes === 'string' && notes ? notes.slice(0, 2000) : null);
            }
            db.prepare(`UPDATE builds SET ${sets.join(', ')} WHERE id = ?`).run(...params, existing.id);
        }
        return { id: existing.id, isNew: false };
    }

    let id = randomId();
    for (let i = 0; i < 10; i++) {
        const exists = db.prepare('SELECT 1 FROM builds WHERE id = ?').get(id);
        if (!exists) break;
        id = randomId();
    }
    const creatorToken = userId ? null : crypto.randomBytes(16).toString('hex');
    db.prepare(
        'INSERT INTO builds (id, token, user_id, state, name, notes, creator_token, class_name, spec, region, power, has_charms, masterwork_count, charm_count, ascension, enhancement_count, skill_point_count, item_count, skills_json, items_json, cz_tree, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    ).run(
        id,
        typeof state.token === 'string' ? state.token : '',
        userId || null,
        canonical,
        name || null,
        typeof notes === 'string' && notes ? String(notes).slice(0, 2000) : null,
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
        summary?.cz_tree || null
    );
    return { id, isNew: true, creatorToken };
}

export function getBuild(id) {
    if (!id || typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return null;
    const row = db
        .prepare(
            'SELECT id, token, user_id, state, name, notes, created_at, updated_at, is_public, anonymous, author_name, author_avatar, class_name, spec, region, power, has_charms, masterwork_count, cz_tree, skills_json, items_json, publicized_at FROM builds WHERE id = ?'
        )
        .get(id);
    if (!row) return null;
    let parsedState = null;
    if (row.state) {
        try {
            parsedState = JSON.parse(row.state);
        } catch (e) {
            parsedState = null;
        }
    }
    return { ...row, parsedState };
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
        params.push(String(name).slice(0, 100));
    }
    if (notes !== undefined) {
        if (typeof notes !== 'string') return false;
        sets.push('notes = ?');
        params.push(notes.slice(0, 2000));
    }
    if (sets.length === 0) return false;
    params.push(id, userId);
    const result = db
        .prepare(`UPDATE builds SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
        .run(...params);
    return result.changes > 0;
}

// Update a build's full state (token + infusions + revelation) in place so
// editing a saved build keeps the same link. Allowed for the owner of an
// owned row, or for whoever holds the creator token of an anonymous row
// (the browser that created it). Everyone else must fork instead — otherwise
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
        params.push(String(name).slice(0, 100));
    }
    if (notes !== undefined && notes !== null) {
        if (typeof notes !== 'string') return false;
        sets.push('notes = ?');
        params.push(notes.slice(0, 2000));
    }
    // NULL never equals NULL in SQL, so a missing creatorToken just never matches.
    params.push(id, userId || null, creatorToken || null);
    const result = db
        .prepare(
            `UPDATE builds SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))`
        )
        .run(...params);
    // A logged-in user editing an anonymous row (matched by its creator token)
    // claims it: the row moves onto their account with the same link, so it
    // shows up on their "My Builds" list and future edits are owner-based.
    if (result.changes > 0 && userId) {
        db.prepare('UPDATE builds SET user_id = ?, creator_token = NULL WHERE id = ? AND user_id IS NULL').run(
            userId,
            id
        );
    }
    return result.changes > 0;
}

export function deleteBuild(id, userId) {
    if (!id || !userId) return false;
    const result = db.prepare('DELETE FROM builds WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
}

// Flip a build's public visibility. Ownership is the same rule as
// updateBuildState: the signed-in owner of an owned row, or the holder of the
// creator token of an anonymous row. The author snapshot + derived filter
// columns are written when publicising (de-publicising only clears the flag).
export function setBuildPublic(id, userId, creatorToken, { isPublic, anonymous, authorName, authorAvatar, summary } = {}) {
    if (!id) return false;
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
        sets.push('publicized_at = datetime(\'now\')');
    }
    // NULL never equals NULL in SQL, so a missing creatorToken just never matches.
    params.push(id, userId || null, creatorToken || null);
    const result = db
        .prepare(
            `UPDATE builds SET ${sets.join(', ')} WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND creator_token = ?))`
        )
        .run(...params);
    // A logged-in user publicising / adjusting an anonymous row they created
    // claims it onto their account (same link), like updateBuildState does.
    if (result.changes > 0 && userId) {
        db.prepare('UPDATE builds SET user_id = ?, creator_token = NULL WHERE id = ? AND user_id IS NULL').run(
            userId,
            id
        );
    }
    return result.changes > 0;
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
        clauses.push('author_name LIKE ? ESCAPE \'\\\'');
        params.push(escapeLike(author));
    }
    if (q) {
        clauses.push('name LIKE ? ESCAPE \'\\\'');
        params.push(escapeLike(q));
    }
    if (item) {
        clauses.push('items_json LIKE ? ESCAPE \'\\\'');
        params.push(escapeLike(item));
    }
    if (skill) {
        clauses.push('skills_json LIKE ? ESCAPE \'\\\'');
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
// de-publicised — the link still works).
export function listFavouriteBuilds({ page = 1, limit = 24, userId = null } = {}) {
    if (!userId) return { builds: [], hasMore: false };
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 24));
    const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
    const favSelect = PUBLIC_FIELDS.split(', ')
        .map((c) => `b.${c}`)
        .join(', ');
    const rows = db
        .prepare(
            `SELECT ${favSelect},
                (SELECT COUNT(*) FROM build_favourites f WHERE f.build_id = b.id) AS fav_count,
                1 AS my_fav
             FROM build_favourites bf
             JOIN builds b ON b.id = bf.build_id
             WHERE bf.user_id = ?
             ORDER BY bf.created_at DESC
             LIMIT ${pageSize + 1} OFFSET ${offset}`
        )
        .all(userId);
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
