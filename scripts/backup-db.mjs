// Database backup / restore CLI.
//
// Usage (from apps/sts):
//   npm run backup:db                       # create a backup now
//   node scripts/backup-db.mjs create [label] [--no-upload]
//   node scripts/backup-db.mjs list [--remote]
//   node scripts/backup-db.mjs prune [--remote]
//   node scripts/backup-db.mjs verify <name|path>
//   node scripts/backup-db.mjs upload <name|--all>
//   node scripts/backup-db.mjs download <name>
//   node scripts/backup-db.mjs restore <name|path> --yes
//
// Backups are consistent copies made with SQLite's online backup API (safe
// while the server is running). When R2_* env vars are set they are also
// uploaded to Cloudflare R2. Restore is the one operation that must run with
// the app stopped (pm2 stop sts / pm2 stop sts-dev).
//
// Environment (.env in apps/sts, or shell):
//   STS_DB_PATH, STS_BACKUP_DIR, STS_BACKUP_KEEP, STS_BACKUP_DAILY_DAYS,
//   STS_BACKUP_WEEKLY_WEEKS, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
//   R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PREFIX, R2_ENDPOINT

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
    getDatabasePath,
    getBackupDir,
    ensureBackupDir,
    createDatabaseBackup,
    listLocalBackups,
    listRemoteBackups,
    pruneLocalBackups,
    pruneRemoteBackups,
    verifyDatabaseFile,
    restoreDatabaseBackup,
} from '../lib/db-backup.js';
import { isR2Configured, describeR2Target, uploadR2Backup, downloadR2Backup } from '../lib/r2-backup.js';

function loadEnv() {
    const file = path.join(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    try {
        if (typeof process.loadEnvFile === 'function') {
            process.loadEnvFile(file);
            return;
        }
    } catch (error) {
        console.warn(`[db-backup] could not load ${file}: ${error.message}`);
    }
    // Fallback for older Node versions: minimal KEY=VALUE parser that does
    // not override variables already present in the environment.
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (!match || line.trim().startsWith('#')) continue;
        if (process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().replace('T', ' ').slice(0, 19) : 'unknown';
}

function resolveLocalBackup(nameOrPath) {
    if (fs.existsSync(nameOrPath)) return nameOrPath;
    const local = path.join(getBackupDir(), nameOrPath);
    return fs.existsSync(local) ? local : null;
}

function openDatabase() {
    const dbPath = getDatabasePath();
    if (!fs.existsSync(dbPath)) {
        console.error(`[db-backup] database not found at ${dbPath}`);
        process.exit(1);
    }
    return new Database(dbPath);
}

function requireR2() {
    if (!isR2Configured()) {
        console.error('[db-backup] R2 is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
        process.exit(1);
    }
}

async function commandCreate(args) {
    const label = args.find((arg) => !arg.startsWith('--')) || '';
    const upload = !args.includes('--no-upload');
    const db = openDatabase();
    try {
        const result = await createDatabaseBackup({ db, label, upload, log: console.log });
        console.log(`[db-backup] created ${result.name} (${formatSize(result.size)})`);
        if (result.remoteKey) console.log(`[db-backup] offsite copy: ${describeR2Target()}${result.name}`);
        else if (upload && !isR2Configured()) console.log('[db-backup] R2 not configured - local backup only');
        const local = pruneLocalBackups({ log: console.log });
        console.log(`[db-backup] retention: kept ${local.kept} local, pruned ${local.deleted.length}`);
        if (isR2Configured()) {
            try {
                const remote = await pruneRemoteBackups({ log: console.log });
                console.log(`[db-backup] retention: kept ${remote.kept} remote, pruned ${remote.deleted.length}`);
            } catch (error) {
                console.warn(`[db-backup] remote prune failed: ${error.message}`);
            }
        }
    } finally {
        db.close();
    }
}

async function commandList(args) {
    const local = listLocalBackups();
    console.log(`[db-backup] ${local.length} local backup(s) in ${getBackupDir()}`);
    for (const backup of local) {
        console.log(`  ${backup.name}  ${formatSize(backup.size).padStart(9)}  ${formatDate(backup.createdAt)}`);
    }
    if (args.includes('--remote')) {
        if (!isR2Configured()) {
            console.log('[db-backup] R2 not configured');
            return;
        }
        const remote = await listRemoteBackups();
        console.log(`[db-backup] ${remote.length} remote backup(s) in ${describeR2Target()}`);
        for (const backup of remote) {
            console.log(`  ${backup.name}  ${formatSize(backup.size).padStart(9)}  ${formatDate(backup.createdAt)}`);
        }
    }
}

async function commandPrune(args) {
    ensureBackupDir();
    const local = pruneLocalBackups({ log: console.log });
    console.log(`[db-backup] kept ${local.kept} local, pruned ${local.deleted.length}`);
    if (args.includes('--remote')) {
        requireR2();
        const remote = await pruneRemoteBackups({ log: console.log });
        console.log(`[db-backup] kept ${remote.kept} remote, pruned ${remote.deleted.length}`);
    }
}

function commandVerify(args) {
    const target = args[0];
    if (!target) {
        console.error('usage: backup-db.mjs verify <name|path>');
        process.exit(1);
    }
    const file = resolveLocalBackup(target);
    if (!file) {
        console.error(`[db-backup] backup not found: ${target}`);
        process.exit(1);
    }
    const check = verifyDatabaseFile(file);
    console.log(`[db-backup] ${file}: ${check.ok ? 'ok' : 'CORRUPT'} (${check.detail})`);
    if (!check.ok) process.exit(1);
}

async function commandUpload(args) {
    requireR2();
    if (args.includes('--all')) {
        const local = listLocalBackups();
        const remoteNames = new Set((await listRemoteBackups()).map((backup) => backup.name));
        let uploaded = 0;
        for (const backup of local) {
            if (remoteNames.has(backup.name)) continue;
            await uploadR2Backup(backup.file, backup.name);
            console.log(`[db-backup] uploaded ${backup.name}`);
            uploaded++;
        }
        console.log(`[db-backup] uploaded ${uploaded} backup(s)`);
        return;
    }
    const name = args[0];
    if (!name) {
        console.error('usage: backup-db.mjs upload <name|--all>');
        process.exit(1);
    }
    const file = resolveLocalBackup(name);
    if (!file) {
        console.error(`[db-backup] backup not found: ${name}`);
        process.exit(1);
    }
    await uploadR2Backup(file, path.basename(file));
    console.log(`[db-backup] uploaded ${path.basename(file)} to ${describeR2Target()}`);
}

async function commandDownload(args) {
    const name = args[0];
    if (!name) {
        console.error('usage: backup-db.mjs download <name>');
        process.exit(1);
    }
    requireR2();
    ensureBackupDir();
    const destination = path.join(getBackupDir(), path.basename(name));
    if (fs.existsSync(destination)) {
        console.error(`[db-backup] already exists: ${destination}`);
        process.exit(1);
    }
    await downloadR2Backup(name, destination);
    const check = verifyDatabaseFile(destination);
    console.log(`[db-backup] downloaded ${name} (${check.ok ? 'verified ok' : `CORRUPT: ${check.detail}`})`);
    if (!check.ok) process.exit(1);
}

async function commandRestore(args) {
    const target = args.find((arg) => !arg.startsWith('--'));
    if (!target) {
        console.error('usage: backup-db.mjs restore <name|path> --yes');
        process.exit(1);
    }
    let file = resolveLocalBackup(target);
    if (!file && isR2Configured()) {
        ensureBackupDir();
        const destination = path.join(getBackupDir(), path.basename(target));
        console.log(`[db-backup] ${target} is not local; downloading from ${describeR2Target()}`);
        await downloadR2Backup(target, destination);
        file = destination;
    }
    if (!file) {
        console.error(`[db-backup] backup not found locally or in R2: ${target}`);
        process.exit(1);
    }

    console.warn('[db-backup] restore replaces the live database. Stop the app first:');
    console.warn('[db-backup]   pm2 stop sts        (production)');
    console.warn('[db-backup]   pm2 stop sts-dev    (dev)');
    const result = restoreDatabaseBackup({
        source: file,
        yes: args.includes('--yes'),
        log: console.log,
    });
    console.log(`[db-backup] restored ${result.restored}`);
    if (result.safety) console.log(`[db-backup] previous database kept at ${result.safety}`);
    console.log('[db-backup] now start the app again: pm2 start sts --update-env (or sts-dev)');
}

async function main() {
    loadEnv();
    const [command, ...args] = process.argv.slice(2);
    switch (command) {
        case 'create':
            await commandCreate(args);
            break;
        case 'list':
            await commandList(args);
            break;
        case 'prune':
            await commandPrune(args);
            break;
        case 'verify':
            commandVerify(args);
            break;
        case 'upload':
            await commandUpload(args);
            break;
        case 'download':
            await commandDownload(args);
            break;
        case 'restore':
            await commandRestore(args);
            break;
        case 'help':
        case undefined:
            console.log('usage: backup-db.mjs <create|list|prune|verify|upload|download|restore> [args]');
            console.log('  create [label] [--no-upload]   make a backup (online, WAL-safe)');
            console.log('  list [--remote]                list local and/or R2 backups');
            console.log('  prune [--remote]               apply retention now');
            console.log('  verify <name|path>             integrity-check a backup');
            console.log('  upload <name|--all>            send local backup(s) to R2');
            console.log('  download <name>                fetch a backup from R2');
            console.log('  restore <name|path> --yes      replace the live DB (app must be stopped)');
            break;
        default:
            console.error(`[db-backup] unknown command "${command}" (try: backup-db.mjs help)`);
            process.exit(1);
    }
}

main().catch((error) => {
    console.error(`[db-backup] ${error.message}`);
    process.exit(1);
});
