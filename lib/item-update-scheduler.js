import { spawn } from 'node:child_process';

// Weekly item data refresh (items.json / item-history.json / skills.json)
// straight on the server, started from instrumentation.js with the server
// process so no system cron is needed. The item pages read these files from
// disk and cache by mtime, so the new data goes live without a rebuild.
//
// The same run can also be started on demand from the moderation page
// (POST /api/v2/moderation/items). Both paths share the "one run at a time"
// lock below and the last run's result, which the moderation panel reads
// from GET /api/v2/moderation/items.
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
let activeRun = null;

// How many of the script's last output lines the moderation page can show.
const OUTPUT_LINES = 40;

// Current/last run, shared by the weekly schedule and the moderation page.
const state = {
    running: false,
    startedAt: null,
    finishedAt: null,
    ok: null,
    actor: null,
    output: [],
};

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

function itemUpdateCommand() {
    return process.env.STS_ITEMS_COMMAND || 'scripts/update-items.mjs';
}

// Snapshot for the moderation page (copy, so callers cannot mutate state).
export function getItemUpdateStatus() {
    return { ...state, output: [...state.output], command: itemUpdateCommand() };
}

// Starts a run unless one is already in flight: returns a promise resolving
// to true/false (the exit status) or null when a run was already active.
// `actor` is only used for the log line and status (who triggered it).
export function startItemUpdate({ actor = null, log = console } = {}) {
    if (activeRun) return null;
    const command = itemUpdateCommand();
    log.info?.(`[items-update] running ${command}${actor ? ` (requested by ${actor})` : ''}`);
    Object.assign(state, {
        running: true,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        ok: null,
        actor,
        output: [],
    });

    activeRun = new Promise((resolve) => {
        const [script, ...args] = command.split(/\s+/).filter(Boolean);
        if (!script) {
            log.error?.('[items-update] no command configured');
            resolve(false);
            return;
        }
        let child;
        try {
            child = spawn(process.execPath, [script, ...args], { cwd: process.cwd() });
        } catch (error) {
            log.error?.(`[items-update] failed to start: ${error.message}`);
            resolve(false);
            return;
        }
        const forward = (write) => (chunk) => {
            for (const line of String(chunk).split(/\r?\n/)) {
                if (!line.trim()) continue;
                const text = line.trimEnd();
                state.output.push(text);
                if (state.output.length > OUTPUT_LINES) state.output.splice(0, state.output.length - OUTPUT_LINES);
                write(text);
            }
        };
        child.stdout.on(
            'data',
            forward((line) => log.info?.(`[items-update] ${line}`))
        );
        child.stderr.on(
            'data',
            forward((line) => log.warn?.(`[items-update] ${line}`))
        );
        child.on('error', (error) => {
            log.error?.(`[items-update] failed to start: ${error.message}`);
            resolve(false);
        });
        child.on('close', (code) => {
            if (code === 0) log.info?.('[items-update] finished');
            else log.error?.(`[items-update] exited with code ${code}`);
            resolve(code === 0);
        });
    }).then((ok) => {
        activeRun = null;
        state.running = false;
        state.ok = ok;
        state.finishedAt = new Date().toISOString();
        return ok;
    });

    return activeRun;
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

    const scheduleNextWeek = () => {
        const current = now();
        const delay = nextRunDelay(day, hour, current);
        const timer = setTimeout(run, delay);
        timer.unref?.();
        log.info?.(`[items-update] next run ${new Date(current.getTime() + delay).toString()}`);
    };

    const run = async (attempt = 0) => {
        const result = await startItemUpdate({ log });
        if (result === null) {
            // A moderator-triggered run is in flight; try again after the
            // usual retry delay instead of starting a second one.
            log.warn?.('[items-update] another run is in progress; retrying later');
            const timer = setTimeout(() => run(attempt), retryMinutes * 60 * 1000);
            timer.unref?.();
            return;
        }
        if (result) {
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
