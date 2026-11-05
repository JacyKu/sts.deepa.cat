import fs from 'node:fs';
import path from 'node:path';
import { createZipBuffer } from './zip.js';
import { getBackupDir, selectBackupsToKeep } from './db-backup.js';
import {
    deleteR2DataBackup,
    describeR2DataTarget,
    isR2DataConfigured,
    listR2DataBackups,
    uploadR2DataBackup,
} from './r2-backup.js';

// Item/class data backups. The items directory is snapshotted into a zip on the
// server, kept locally next to the database backups, and uploaded to R2 under
// the data prefix when R2 is configured. The format is deliberately simple so
// a server with no zip package can still create and verify the archive.
//
//   STS_ITEMS_DIR       items directory (default "public/items")
//   STS_BACKUP_DIR      local backup directory (shared with database backups)
//   R2_DATA_PREFIX      optional separate R2 prefix (defaults to R2_PREFIX)
//
// The local `items/backups` folder is excluded: it already contains the
// rolling recovery copies made by the data update scripts.

export function getItemsDir() {
    return process.env.STS_ITEMS_DIR || path.join(process.cwd(), 'public', 'items');
}

function pad(value) {
    return String(value).padStart(2, '0');
}

export function dataBackupFileName(date = new Date(), label = '') {
    const stamp =
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const suffix = label
        ? `-${String(label)
              .replace(/[^a-zA-Z0-9._-]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 40)}`
        : '';
    return `sts-items-${stamp}${suffix}.zip`;
}

export function parseDataBackupTimestamp(name) {
    const match = /^sts-items-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
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

function collectEntries(dir, root = dir, entries = []) {
    const children = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
        const fullPath = path.join(dir, child.name);
        if (child.isDirectory()) {
            // These are the update scripts' own rolling recovery copies, not
            // item/class data; do not nest backups inside backups.
            if (child.name === 'backups') continue;
            collectEntries(fullPath, root, entries);
            continue;
        }
        if (!child.isFile()) continue;
        const relative = path.relative(root, fullPath).replace(/\\/g, '/');
        entries.push({
            name: `items/${relative}`,
            data: fs.readFileSync(fullPath),
        });
    }
    return entries;
}

export async function createDataBackup({
    label = '',
    upload = true,
    log = () => {},
    itemsDir = getItemsDir(),
    backupDir = getBackupDir(),
} = {}) {
    if (!fs.existsSync(itemsDir)) throw new Error(`items directory not found: ${itemsDir}`);
    const entries = collectEntries(itemsDir);
    if (entries.length === 0) throw new Error(`no item/class data files found in ${itemsDir}`);

    fs.mkdirSync(backupDir, { recursive: true });
    const date = new Date();
    const name = dataBackupFileName(date, label);
    const file = path.join(backupDir, name);
    const temporary = `${file}.tmp`;
    const zip = createZipBuffer(entries, { date });
    fs.writeFileSync(temporary, zip);
    fs.renameSync(temporary, file);

    let remoteKey = null;
    let remoteError = null;
    if (upload && isR2DataConfigured()) {
        try {
            remoteKey = await uploadR2DataBackup(file, name);
            log(`[data-backup] uploaded ${name} to ${describeR2DataTarget()}`);
        } catch (error) {
            remoteError = error.message;
            log(`[data-backup] R2 upload failed for ${name}: ${error.message}`);
        }
    } else if (upload) {
        log('[data-backup] R2 not configured - local archive only');
    }

    return {
        name,
        file,
        size: fs.statSync(file).size,
        createdAt: parseDataBackupTimestamp(name) || date,
        fileCount: entries.length,
        remoteKey,
        remoteError,
    };
}

export function listLocalDataBackups() {
    const dir = getBackupDir();
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => name.startsWith('sts-items-') && name.endsWith('.zip'))
        .map((name) => {
            const file = path.join(dir, name);
            const stat = fs.statSync(file);
            return {
                name,
                file,
                size: stat.size,
                createdAt: parseDataBackupTimestamp(name) || stat.mtime,
            };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function pruneLocalDataBackups({ log = () => {} } = {}) {
    const backups = listLocalDataBackups();
    const keep = selectBackupsToKeep(backups);
    const deleted = [];
    for (const backup of backups) {
        if (keep.has(backup.name)) continue;
        fs.rmSync(backup.file, { force: true });
        deleted.push(backup.name);
        log(`[data-backup] pruned local ${backup.name}`);
    }
    return { deleted, kept: backups.length - deleted.length };
}

export async function listRemoteDataBackups() {
    const objects = await listR2DataBackups();
    return objects
        .filter((object) => object.name.endsWith('.zip'))
        .map((object) => ({
            ...object,
            createdAt: parseDataBackupTimestamp(object.name) || object.lastModified || new Date(0),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

export async function pruneRemoteDataBackups({ log = () => {} } = {}) {
    if (!isR2DataConfigured()) return { deleted: [], kept: 0, skipped: true };
    const backups = await listRemoteDataBackups();
    const keep = selectBackupsToKeep(backups);
    const deleted = [];
    for (const backup of backups) {
        if (keep.has(backup.name)) continue;
        await deleteR2DataBackup(backup.key);
        deleted.push(backup.name);
        log(`[data-backup] pruned R2 ${backup.name}`);
    }
    return { deleted, kept: backups.length - deleted.length };
}
