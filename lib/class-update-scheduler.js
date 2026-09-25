import { spawn } from 'node:child_process';

// On-demand class data refresh (skills.json / class-history.json), started
// from the moderation page's Classes panel via POST
// /api/v2/moderation/classes. Unlike the item scheduler this has no weekly
// timer: the weekly item run already refreshes and archives class data, so
// this path exists for manual refreshes (a class change was just announced,
// a failed weekly run needs a retry, ...).
//
//   STS_CLASSES_COMMAND=scripts/update-classes.mjs
//                                  Node script run from the app root; extra
//                                  arguments are allowed (e.g. --dry-run)

let activeRun = null;

// How many of the script's last output lines the moderation page can show.
const OUTPUT_LINES = 40;

// Current/last run, read by GET /api/v2/moderation/classes.
const state = {
    running: false,
    startedAt: null,
    finishedAt: null,
    ok: null,
    actor: null,
    output: [],
};

function classUpdateCommand() {
    return process.env.STS_CLASSES_COMMAND || 'scripts/update-classes.mjs';
}

// Snapshot for the moderation page (copy, so callers cannot mutate state).
export function getClassUpdateStatus() {
    return { ...state, output: [...state.output], command: classUpdateCommand() };
}

// Starts a run unless one is already in flight: returns a promise resolving
// to true/false (the exit status) or null when a run was already active.
// `actor` is only used for the log line and status (who triggered it).
export function startClassUpdate({ actor = null, log = console } = {}) {
    if (activeRun) return null;
    const command = classUpdateCommand();
    log.info?.(`[classes-update] running ${command}${actor ? ` (requested by ${actor})` : ''}`);
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
            log.error?.('[classes-update] no command configured');
            resolve(false);
            return;
        }
        let child;
        try {
            child = spawn(process.execPath, [script, ...args], { cwd: process.cwd() });
        } catch (error) {
            log.error?.(`[classes-update] failed to start: ${error.message}`);
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
            forward((line) => log.info?.(`[classes-update] ${line}`))
        );
        child.stderr.on(
            'data',
            forward((line) => log.warn?.(`[classes-update] ${line}`))
        );
        child.on('error', (error) => {
            log.error?.(`[classes-update] failed to start: ${error.message}`);
            resolve(false);
        });
        child.on('close', (code) => {
            if (code === 0) log.info?.('[classes-update] finished');
            else log.error?.(`[classes-update] exited with code ${code}`);
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
