import { createDatabaseBackup, pruneLocalBackups, pruneRemoteBackups } from './db-backup.js';
import { getDb } from './sts-builds.js';

// Scheduled database backups. Started from instrumentation.js when the Next
// server boots, so a long-running pm2 process snapshots the database on a
// fixed interval without needing system cron.
//
//   STS_BACKUP_DISABLED=1                 turn the scheduler off
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
        const timer = setTimeout(run, intervalHours * 60 * 60 * 1000);
        timer.unref?.();
    };

    const first = setTimeout(run, initialDelayMinutes * 60 * 1000);
    first.unref?.();
    log.info?.(`[db-backup] scheduler started (every ${intervalHours}h, first in ${initialDelayMinutes}m)`);
    return true;
}
