import { createDatabaseBackup, pruneLocalBackups, pruneRemoteBackups } from './db-backup.js';
import {
    createDataBackup,
    pruneLocalDataBackups,
    pruneRemoteDataBackups,
} from './data-backup.js';
import { getDb } from './sts-builds.js';

// Scheduled database + item/class data backups. Started from instrumentation.js
// when the Next server boots, so a long-running pm2 process snapshots both on a
// fixed interval without needing system cron.
//
//   STS_BACKUP_DISABLED=1                 turn the scheduler off
//   STS_DATA_BACKUP_DISABLED=1            skip the item/class data zip only
//   STS_BACKUP_INTERVAL_HOURS=24          time between backups (daily)
//   STS_BACKUP_INITIAL_DELAY_MINUTES=2    wait after boot before the first one

let started = false;

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function startBackupScheduler(log = console) {
    if (started) return false;
    started = true;

    if (process.env.STS_BACKUP_DISABLED === '1') {
        log.info?.('[db-backup] scheduler disabled (STS_BACKUP_DISABLED=1)');
        return false;
    }

    const intervalHours = positiveNumber(process.env.STS_BACKUP_INTERVAL_HOURS, 24);
    const initialDelayMinutes = positiveNumber(process.env.STS_BACKUP_INITIAL_DELAY_MINUTES, 2);

    const run = async () => {
        try {
            const result = await createDatabaseBackup({ db: getDb(), label: 'scheduled', log: (m) => log.info?.(m) });
            const local = pruneLocalBackups({ log: (m) => log.info?.(m) });
            let remote = { deleted: [] };
            try {
                remote = await pruneRemoteBackups({ log: (m) => log.info?.(m) });
            } catch (error) {
                log.warn?.(`[db-backup] remote prune failed: ${error.message}`);
            }
            log.info?.(
                `[db-backup] ${result.name} (${result.size} bytes)` +
                    `${result.remoteKey ? ' uploaded to R2' : ''}; kept ${local.kept} local` +
                    `, pruned ${local.deleted.length} local / ${remote.deleted.length} remote`
            );
        } catch (error) {
            log.error?.(`[db-backup] scheduled backup failed: ${error.message}`);
        }

        // Item/class data rides along with the same schedule and backup
        // prefix. The list/prune helpers filter by extension so a zip and a
        // .db are never treated as the same kind of backup.
        if (process.env.STS_DATA_BACKUP_DISABLED !== '1') {
            try {
                const result = await createDataBackup({
                    label: 'scheduled',
                    log: (m) => log.info?.(m),
                });
                const local = pruneLocalDataBackups({ log: (m) => log.info?.(m) });
                let remote = { deleted: [] };
                try {
                    remote = await pruneRemoteDataBackups({ log: (m) => log.info?.(m) });
                } catch (error) {
                    log.warn?.(`[data-backup] remote prune failed: ${error.message}`);
                }
                log.info?.(
                    `[data-backup] ${result.name} (${result.size} bytes, ${result.fileCount} files)` +
                        `${result.remoteKey ? ' uploaded to R2' : ''}; kept ${local.kept} local` +
                        `, pruned ${local.deleted.length} local / ${remote.deleted.length} remote`
                );
            } catch (error) {
                log.error?.(`[data-backup] scheduled backup failed: ${error.message}`);
            }
        }

        const timer = setTimeout(run, intervalHours * 60 * 60 * 1000);
        timer.unref?.();
    };

    const first = setTimeout(run, initialDelayMinutes * 60 * 1000);
    first.unref?.();
    log.info?.(`[db-backup] scheduler started (every ${intervalHours}h, first in ${initialDelayMinutes}m)`);
    return true;
}
