import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

// Minecraft head images cached in the site's SQLite database. A UUID is
// fetched from the upstream render API exactly once; every later request (on
// any device) is served from our own copy, so the images never depend on the
// visitor's network being able to reach the upstream host.
//
// The table lives in the same database file as the rest of the site data
// (DB_PATH mirrors lib/sts-builds.js), which means it is included in the
// normal database backups and survives redeploys.
const DB_PATH = process.env.STS_DB_PATH || path.join(process.cwd(), 'data', 'sts-builds.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS minecraft_avatars (
    uuid TEXT PRIMARY KEY,
    image BLOB NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'image/png',
    fetched_at INTEGER NOT NULL
  );
`);

const getStatement = db.prepare('SELECT image, content_type, fetched_at FROM minecraft_avatars WHERE uuid = ?');
const saveStatement = db.prepare(`
  INSERT INTO minecraft_avatars (uuid, image, content_type, fetched_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(uuid) DO UPDATE SET
    image = excluded.image,
    content_type = excluded.content_type,
    fetched_at = excluded.fetched_at
`);

// The stored avatar for a UUID: { buffer, contentType, fetchedAt }, or null
// when that UUID has never been fetched.
export function getCachedMinecraftAvatar(uuid) {
    if (!uuid) return null;
    let row = null;
    try {
        row = getStatement.get(uuid);
    } catch (e) {
        return null;
    }
    if (!row || !row.image || row.image.length === 0) return null;
    return {
        buffer: Buffer.isBuffer(row.image) ? row.image : Buffer.from(row.image),
        contentType: row.content_type || 'image/png',
        fetchedAt: row.fetched_at || 0,
    };
}

export function saveMinecraftAvatar(uuid, buffer, contentType) {
    if (!uuid || !buffer || buffer.length === 0) return false;
    try {
        saveStatement.run(uuid, buffer, contentType || 'image/png', Date.now());
        return true;
    } catch (e) {
        return false;
    }
}

// Drops the stored head so the next lookup fetches a fresh render (used when
// an account is linked/re-linked and the current skin must show).
export function deleteCachedMinecraftAvatar(uuid) {
    if (!uuid) return false;
    try {
        return db.prepare('DELETE FROM minecraft_avatars WHERE uuid = ?').run(uuid).changes > 0;
    } catch (e) {
        return false;
    }
}
