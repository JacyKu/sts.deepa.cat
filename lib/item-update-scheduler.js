import { spawn } from 'node:child_process';

// Weekly item data refresh (items.json / item-history.json / skills.json)
// straight on the server, started from instrumentation.js with the server
// process so no system cron is needed. The item pages read these files from
// disk and cache by mtime, so the new data goes live without a rebuild.
//
//   STS_ITEMS_DISABLED=1           turn the scheduler off (e.g. on dev)
//   STS_ITEMS_DAY=4                day of week to run (0=Sun ... 6=Sat, 4=Thu)
//   STS_ITEMS_HOUR=5               hour to run, server local time (0-23)
//   STS_ITEMS_RETRIES=3            extra attempts after a failed fetch
//   STS_ITEMS_RETRY_MINUTES=30     wait between those attempts
//   STS_ITEMS_COMMAND=scripts/update-items.mjs
//                                  Node script run from the app root; extra
//                                  arguments are allowed (e.g. --dry-run)
//
// The run happens once on the configured day/hour; a failed fetch is retried
// up to STS_ITEMS_RETRIES times, then the week is given up on.

let started = false;

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function integerInRange(value, fallback, min, max) {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function nextRunDelay(day, hour, now = new Date()) {
    const next = new Date(now);
    next.setDate(next.getDate() + ((day - next.getDay() + 7) % 7));
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 7);
    return next.getTime() - now.getTime();
}

function runUpdate(command, log) {
    const [script, ...args] = command.split(/\s+/).filter(Boolean);
    return new Promise((resolve) => {
        log.info?.(`[items-update] running ${command}`);
        const child = spawn(process.execPath, [script, ...args], { cwd: process.cwd() });
        child.stdout.on('data', (chunk) => log.info?.(`[items-update] ${String(chunk).trimEnd()}`));
        child.stderr.on('data', (chunk) => log.warn?.(`[items-update] ${String(chunk).trimEnd()}`));
        child.on('error', (error) => {
            log.error?.(`[items-update] failed to start: ${error.message}`);
            resolve(false);
        });
        child.on('close', (code) => {
            if (code === 0) log.info?.('[items-update] finished');
            else log.error?.(`[items-update] exited with code ${code}`);
            resolve(code === 0);
        });
    });
}

export function startItemUpdateScheduler(log = console, now = () => new Date()) {
    if (started) return false;
    started = true;

    if (process.env.STS_ITEMS_DISABLED === '1') {
        log.info?.('[items-update] scheduler disabled (STS_ITEMS_DISABLED=1)');
        return false;
    }

    const day = integerInRange(process.env.STS_ITEMS_DAY, 4, 0, 6);
    const hour = integerInRange(process.env.STS_ITEMS_HOUR, 5, 0, 23);
    const retries = integerInRange(process.env.STS_ITEMS_RETRIES, 3, 0, 10);
    const retryMinutes = positiveNumber(process.env.STS_ITEMS_RETRY_MINUTES, 30);
    const command = process.env.STS_ITEMS_COMMAND || 'scripts/update-items.mjs';

    const scheduleNextWeek = () => {
        const current = now();
        const delay = nextRunDelay(day, hour, current);
        const timer = setTimeout(run, delay);
        timer.unref?.();
        log.info?.(`[items-update] next run ${new Date(current.getTime() + delay).toString()}`);
    };

    const run = async (attempt = 0) => {
        if (await runUpdate(command, log)) {
            scheduleNextWeek();
            return;
        }
        if (attempt < retries) {
            const wait = retryMinutes * 60 * 1000;
            log.warn?.(`[items-update] attempt ${attempt + 1} failed; retrying in ${retryMinutes}m`);
            const timer = setTimeout(() => run(attempt + 1), wait);
            timer.unref?.();
        } else {
            log.error?.(`[items-update] failed after ${attempt + 1} attempt(s); trying again next week`);
            scheduleNextWeek();
        }
    };

    log.info?.(
        `[items-update] scheduler started (day ${day} at ${String(hour).padStart(2, '0')}:00 server time, ${retries} retr${retries === 1 ? 'y' : 'ies'} every ${retryMinutes}m)`
    );
    scheduleNextWeek();
    return true;
}
