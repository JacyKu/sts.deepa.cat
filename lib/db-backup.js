import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
    uploadR2Backup,
    listR2Backups,
    deleteR2Backup,
    isR2Configured,
    describeR2Target,
} from './r2-backup.js';

// Database backup system. Backups are full copies of the SQLite database made
// with better-sqlite3's online backup API, so they are consistent even while
// the server is writing (a plain file copy of a WAL database is not).
//
//   data/backups/sts-builds-YYYYMMDD-HHMMSS[-label].db
//
// Retention: backups are deleted once they are older than
// STS_BACKUP_MAX_AGE_DAYS (default 30), except the newest
// STS_BACKUP_KEEP (default 1) which are always kept. See readRetentionOptions().
//
// Every created backup is verified (PRAGMA integrity_check) before it is
// reported as good, and uploaded to Cloudflare R2 when R2_* env vars are set.

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDatabasePath() {
    return process.env.STS_DB_PATH || path.join(process.cwd(), 'data', 'sts-builds.db');
}

export function getBackupDir() {
    return process.env.STS_BACKUP_DIR || path.join(path.dirname(getDatabasePath()), 'backups');
}

export function ensureBackupDir() {
    const dir = getBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

export function backupFileName(date = new Date(), label = '') {
    const stamp =
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const suffix = label
        ? `-${String(label)
              .replace(/[^a-zA-Z0-9._-]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 40)}`
        : '';
    return `sts-builds-${stamp}${suffix}.db`;
}

// Timestamp encoded in the file name; falls back to null for foreign files.
export function parseBackupTimestamp(name) {
    const match = /^sts-builds-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
    if (!match) return null;
    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
    );
}

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function readRetentionOptions() {
    return {
        maxAgeDays: positiveNumber(process.env.STS_BACKUP_MAX_AGE_DAYS, 30),
        keepNewest: Math.floor(positiveNumber(process.env.STS_BACKUP_KEEP, 1)),
    };
}

// Pure retention decision: which backup names to keep. `backups` is a list of
// { name, createdAt } in any order.
export function selectBackupsToKeep(backups, options = readRetentionOptions()) {
    const sorted = [...backups].sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
    const keep = new Set();
    for (const backup of sorted.slice(0, options.keepNewest)) keep.add(backup.name);

    const cutoff = Date.now() - options.maxAgeDays * DAY_MS;
    for (const backup of sorted) {
        if ((backup.createdAt?.getTime?.() || 0) >= cutoff) keep.add(backup.name);
    }
    return keep;
}

export function verifyDatabaseFile(file) {
    // Opening a WAL-mode database - even read-only - can create -wal/-shm
    // sidecars next to it. Remove only the ones we created ourselves, so this
    // stays safe if it is ever pointed at a live database.
    const sidecars = ['-wal', '-shm'];
    const preexisting = new Set(sidecars.filter((suffix) => fs.existsSync(file + suffix)));
    let db;
    try {
        db = new Database(file, { readonly: true, fileMustExist: true });
        const rows = db.pragma('integrity_check');
        const detail = Array.isArray(rows)
            ? rows.map((row) => Object.values(row)[0]).join('; ')
            : String(rows);
        return { ok: detail.trim().toLowerCase() === 'ok', detail };
    } catch (error) {
        return { ok: false, detail: error.message };
    } finally {
        try {
            db?.close();
        } catch (error) {
            // already closed
        }
        for (const suffix of sidecars) {
            if (!preexisting.has(suffix)) fs.rmSync(file + suffix, { force: true });
        }
    }
}

export function listLocalBackups() {
    const dir = getBackupDir();
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.db'))
        .map((name) => {
            const file = path.join(dir, name);
            const stat = fs.statSync(file);
            return {
                name,
                file,
                size: stat.size,
                createdAt: parseBackupTimestamp(name) || stat.mtime,
            };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listRemoteBackups() {
    const objects = await listR2Backups();
    return objects
        .map((object) => ({
            ...object,
            createdAt: parseBackupTimestamp(object.name) || object.lastModified || new Date(0),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

// Creates a verified, WAL-safe backup of `db` (an open better-sqlite3
// Database). Uploads it to R2 when configured and `upload` is true; an R2
// failure is reported but does not discard the local backup.
export async function createDatabaseBackup({ db, label = '', upload = true, log = () => {} } = {}) {
    if (!db) throw new Error('createDatabaseBackup requires an open database');
    ensureBackupDir();
    const name = backupFileName(new Date(), label);
    const file = path.join(getBackupDir(), name);

    await db.backup(file);
    // Keep the main database file current and the WAL small between backups.
    try {
        db.pragma('wal_checkpoint(PASSIVE)');
    } catch (error) {
        log(`[db-backup] checkpoint skipped: ${error.message}`);
    }

    const check = verifyDatabaseFile(file);
    if (!check.ok) {
        fs.rmSync(file, { force: true });
        throw new Error(`backup failed integrity check: ${check.detail}`);
    }

    let remoteKey = null;
    let remoteError = null;
    if (upload && isR2Configured()) {
        try {
            remoteKey = await uploadR2Backup(file, name);
            log(`[db-backup] uploaded ${name} to ${describeR2Target()}`);
        } catch (error) {
            remoteError = error.message;
            log(`[db-backup] R2 upload failed for ${name}: ${error.message}`);
        }
    }

    return {
        name,
        file,
        size: fs.statSync(file).size,
        createdAt: parseBackupTimestamp(name) || new Date(),
        remoteKey,
        remoteError,
    };
}

export function pruneLocalBackups({ log = () => {} } = {}) {
    const backups = listLocalBackups();
    const keep = selectBackupsToKeep(backups);
    const deleted = [];
    for (const backup of backups) {
        if (keep.has(backup.name)) continue;
        fs.rmSync(backup.file, { force: true });
        deleted.push(backup.name);
        log(`[db-backup] pruned local ${backup.name}`);
    }
    return { deleted, kept: backups.length - deleted.length };
}

export async function pruneRemoteBackups({ log = () => {} } = {}) {
    if (!isR2Configured()) return { deleted: [], kept: 0, skipped: true };
    const backups = await listRemoteBackups();
    const keep = selectBackupsToKeep(backups);
    const deleted = [];
    for (const backup of backups) {
        if (keep.has(backup.name)) continue;
        await deleteR2Backup(backup.key);
        deleted.push(backup.name);
        log(`[db-backup] pruned R2 ${backup.name}`);
    }
    return { deleted, kept: backups.length - deleted.length };
}

// Replaces the live database with a backup file. Only safe while the server
// is stopped: the running process holds an open connection and its WAL. The
// current database is copied to data/backups/pre-restore/ first.
export function restoreDatabaseBackup({ source, dbPath = getDatabasePath(), yes = false, log = () => {} } = {}) {
    if (!yes) throw new Error('restore requires --yes (it replaces the live database)');
    if (!source || !fs.existsSync(source)) throw new Error(`backup file not found: ${source}`);

    const check = verifyDatabaseFile(source);
    if (!check.ok) throw new Error(`backup failed integrity check: ${check.detail}`);

    let safety = null;
    if (fs.existsSync(dbPath)) {
        const safetyDir = path.join(getBackupDir(), 'pre-restore');
        fs.mkdirSync(safetyDir, { recursive: true });
        const stamp = backupFileName(new Date()).replace(/^sts-builds-/, '').replace(/\.db$/, '');
        safety = path.join(safetyDir, `pre-restore-${stamp}.db`);
        fs.copyFileSync(dbPath, safety);
        for (const sidecar of ['-wal', '-shm']) {
            if (fs.existsSync(dbPath + sidecar)) fs.copyFileSync(dbPath + sidecar, safety + sidecar);
        }
        log(`[db-backup] current database saved to ${safety}`);
    }

    for (const sidecar of ['-wal', '-shm']) fs.rmSync(dbPath + sidecar, { force: true });
    fs.copyFileSync(source, dbPath);
    log(`[db-backup] restored ${source} -> ${dbPath}`);
    return { restored: dbPath, safety };
}
