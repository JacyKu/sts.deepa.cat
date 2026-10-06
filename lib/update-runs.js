import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './sts-builds.js';

// Correct the date of a recorded API update run (item-history.json).
//
// A run's `at` timestamp is both the entry's displayed date and the key that
// pairs every archived item record with its run, so renaming it rewrites the
// run plus every archive record stamped with that date. Name polls attached
// to the run follow the new date as well. This is a moderation correction for
// mis-recorded dates - the update scripts keep writing runs themselves.

const HISTORY_BACKUPS_KEPT = 10;

function historyFile() {
    return path.join(process.cwd(), 'public', 'items', 'item-history.json');
}

function backupsDir() {
    return path.join(process.cwd(), 'public', 'items', 'backups');
}

function readHistory() {
    try {
        return JSON.parse(fs.readFileSync(historyFile(), 'utf8'));
    } catch (err) {
        return null;
    }
}

function writeFileAtomic(target, contents) {
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, contents);
    fs.renameSync(tmp, target);
}

// Timestamped copy of the outgoing history, pruned to the newest few - the
// same safety net the update scripts use before rewriting the archive.
function backupHistory() {
    try {
        const existing = fs.readFileSync(historyFile(), 'utf8');
        if (!existing.trim()) return;
        fs.mkdirSync(backupsDir(), { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.writeFileSync(path.join(backupsDir(), `item-history-${stamp}.json`), existing);
        const backups = fs
            .readdirSync(backupsDir())
            .filter((name) => name.startsWith('item-history-') && name.endsWith('.json'))
            .sort();
        for (const name of backups.slice(0, Math.max(0, backups.length - HISTORY_BACKUPS_KEPT))) {
            fs.rmSync(path.join(backupsDir(), name), { force: true });
        }
    } catch (err) {
        // First run or unreadable file - nothing to back up.
    }
}

// All recorded API update runs, newest first, with their change counts.
export function listUpdateRuns() {
    const history = readHistory();
    if (!history || !Array.isArray(history.runs)) return [];
    return history.runs.map((run) => ({
        at: run.at,
        added: (run.added || []).length,
        changed: (run.changed || []).length,
        removed: (run.removed || []).length,
    }));
}

// Renames the run recorded at `oldAt` to `newAt` (any parseable date; stored
// in the archive's ISO shape). Returns { history } with what moved, or
// { error } for invalid/missing/duplicate dates.
export function changeUpdateRunDate(oldAt, newAt) {
    if (typeof oldAt !== 'string' || typeof newAt !== 'string') return { error: 'invalid-date' };
    const parsed = Date.parse(newAt);
    if (!Number.isFinite(parsed)) return { error: 'invalid-date' };
    const iso = new Date(parsed).toISOString();
    const history = readHistory();
    if (!history || !Array.isArray(history.runs)) return { error: 'unavailable' };
    const index = history.runs.findIndex((run) => run.at === oldAt);
    if (index === -1) return { error: 'not-found' };
    const previous = history.runs[index].at;
    if (previous === iso) return { unchanged: true };
    if (history.runs.some((run) => run.at === iso)) return { error: 'duplicate-date' };

    history.runs[index] = { ...history.runs[index], at: iso };
    // Archive records are stamped with the run's date; keep the pairing so
    // the before/after diffs on the changes page stay intact.
    let records = 0;
    for (const list of Object.values(history.items || {})) {
        if (!Array.isArray(list)) continue;
        for (const record of list) {
            if (record.at === previous) {
                record.at = iso;
                records++;
            }
        }
    }
    // Keep the newest-first ordering after the edit.
    history.runs.sort((a, b) => String(b.at).localeCompare(String(a.at)));

    try {
        backupHistory();
        writeFileAtomic(historyFile(), JSON.stringify(history));
    } catch (err) {
        return { error: 'write-failed' };
    }

    // Name polls attached to the run follow it to the new date.
    let polls = 0;
    try {
        const info = getDb()
            .prepare("UPDATE polls SET run_at = ? WHERE run_at = ? AND kind = 'api'")
            .run(iso, previous);
        polls = info.changes;
    } catch (err) {
        // Poll tables unavailable - the history correction still went through.
    }
    return { history: { at: previous, newAt: iso, records, polls } };
}
