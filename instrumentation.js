export async function register() {
    // Runs once per server process. Backups need the Node runtime and must
    // not run during `next build` (NEXT_PHASE is set then).
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    try {
        const { startBackupScheduler } = await import('./lib/db-backup-scheduler.js');
        startBackupScheduler();
    } catch (error) {
        console.error('[db-backup] failed to start scheduler:', error);
    }
}
