// Item/class data backup CLI.
//
// Usage (from apps/sts):
//   npm run backup:data
//   node scripts/backup-data.mjs create [label] [--no-upload]
//   node scripts/backup-data.mjs list [--remote]
//   node scripts/backup-data.mjs prune [--remote]
//   node scripts/backup-data.mjs upload <name|--all>
//
// The archive contains every regular file under public/items (except the
// update scripts' rolling backups/ folder), as items/... entries. It is written
// next to the database backups and uploaded to R2 when R2_* is configured.

import fs from 'node:fs';
import path from 'node:path';
import {
    createDataBackup,
    listLocalDataBackups,
    listRemoteDataBackups,
    pruneLocalDataBackups,
    pruneRemoteDataBackups,
} from '../lib/data-backup.js';
import { getBackupDir } from '../lib/db-backup.js';
import { isR2Configured, describeR2DataTarget, uploadR2DataBackup } from '../lib/r2-backup.js';

function loadEnv() {
    const file = path.join(process.cwd(), '.' + 'env');
    if (!fs.existsSync(file)) return;
    try {
        if (typeof process.loadEnvFile === 'function') {
            process.loadEnvFile(file);
            return;
        }
    } catch (error) {
        console.warn(`[data-backup] could not load environment file: ${error.message}`);
    }
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

function resolveLocal(nameOrPath) {
    if (fs.existsSync(nameOrPath)) return nameOrPath;
    const local = path.join(getBackupDir(), nameOrPath);
    return fs.existsSync(local) ? local : null;
}

async function commandCreate(args) {
    const label = args.find((arg) => !arg.startsWith('--')) || '';
    const upload = !args.includes('--no-upload');
    const result = await createDataBackup({ label, upload, log: console.log });
    console.log(
        `[data-backup] created ${result.name} (${formatSize(result.size)}, ${result.fileCount} files)`
    );
    if (result.remoteKey) console.log(`[data-backup] offsite copy: ${describeR2DataTarget()}${result.name}`);
    else if (upload && !isR2Configured()) console.log('[data-backup] R2 not configured - local archive only');
    const local = pruneLocalDataBackups({ log: console.log });
    console.log(`[data-backup] retention: kept ${local.kept} local, pruned ${local.deleted.length}`);
    if (isR2Configured()) {
        try {
            const remote = await pruneRemoteDataBackups({ log: console.log });
            console.log(`[data-backup] retention: kept ${remote.kept} remote, pruned ${remote.deleted.length}`);
        } catch (error) {
            console.warn(`[data-backup] remote prune failed: ${error.message}`);
        }
    }
}

async function commandList(args) {
    const local = listLocalDataBackups();
    console.log(`[data-backup] ${local.length} local archive(s) in ${getBackupDir()}`);
    for (const backup of local) {
        console.log(`  ${backup.name}  ${formatSize(backup.size).padStart(9)}  ${formatDate(backup.createdAt)}`);
    }
    if (args.includes('--remote')) {
        if (!isR2Configured()) {
            console.log('[data-backup] R2 not configured');
            return;
        }
        const remote = await listRemoteDataBackups();
        console.log(`[data-backup] ${remote.length} remote archive(s) in ${describeR2DataTarget()}`);
        for (const backup of remote) {
            console.log(`  ${backup.name}  ${formatSize(backup.size).padStart(9)}  ${formatDate(backup.createdAt)}`);
        }
    }
}

async function commandPrune(args) {
    const local = pruneLocalDataBackups({ log: console.log });
    console.log(`[data-backup] kept ${local.kept} local, pruned ${local.deleted.length}`);
    if (args.includes('--remote')) {
        if (!isR2Configured()) {
            console.error('[data-backup] R2 is not configured');
            process.exit(1);
        }
        const remote = await pruneRemoteDataBackups({ log: console.log });
        console.log(`[data-backup] kept ${remote.kept} remote, pruned ${remote.deleted.length}`);
    }
}

async function commandUpload(args) {
    if (!isR2Configured()) {
        console.error('[data-backup] R2 is not configured');
        process.exit(1);
    }
    if (args.includes('--all')) {
        const local = listLocalDataBackups();
        const remoteNames = new Set((await listRemoteDataBackups()).map((backup) => backup.name));
        let uploaded = 0;
        for (const backup of local) {
            if (remoteNames.has(backup.name)) continue;
            await uploadR2DataBackup(backup.file, backup.name);
            console.log(`[data-backup] uploaded ${backup.name}`);
            uploaded++;
        }
        console.log(`[data-backup] uploaded ${uploaded} archive(s)`);
        return;
    }
    const name = args[0];
    if (!name) {
        console.error('usage: backup-data.mjs upload <name|--all>');
        process.exit(1);
    }
    const file = resolveLocal(name);
    if (!file) {
        console.error(`[data-backup] archive not found: ${name}`);
        process.exit(1);
    }
    await uploadR2DataBackup(file, path.basename(file));
    console.log(`[data-backup] uploaded ${path.basename(file)} to ${describeR2DataTarget()}`);
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
        case 'upload':
            await commandUpload(args);
            break;
        case 'help':
        case undefined:
            console.log('usage: backup-data.mjs <create|list|prune|upload> [args]');
            console.log('  create [label] [--no-upload]   zip public/items and keep/upload it');
            console.log('  list [--remote]                list local and/or R2 archives');
            console.log('  prune [--remote]               apply retention now');
            console.log('  upload <name|--all>            send local archive(s) to R2');
            break;
        default:
            console.error(`[data-backup] unknown command "${command}" (try: backup-data.mjs help)`);
            process.exit(1);
    }
}

main().catch((error) => {
    console.error(`[data-backup] ${error.message}`);
    process.exit(1);
});
