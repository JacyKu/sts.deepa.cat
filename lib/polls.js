import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './sts-builds.js';

// Update name polls.
//
// Class updates are named by the community: Discord users signed into the
// site vote for one of the moderator's starter options or add their own name
// idea. The structured poll keeps name spam out of the Discord chat. A poll
// can be attached to a recorded class update run (kind + run_at); once closed
// with a winner, the winning name is shown as that run's title on the class
// changes page.
//
// Spam rules, enforced here so every client path shares them:
//   - one vote per user per poll (changing the vote moves it),
//   - one suggested name per user per poll,
//   - names are unique per poll (case-insensitive) and length-capped,
//   - routes additionally reject profanity and rate-limit writes.

const db = getDb();

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    kind TEXT NOT NULL DEFAULT 'class',
    status TEXT NOT NULL DEFAULT 'open',
    run_at TEXT,
    winner_option_id INTEGER,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    submitted_by TEXT,
    removed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options (poll_id);

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poll_id, user_id)
  );
`);

// One suggestion per user per poll. Seed options have no submitter (NULL), so
// the partial index only covers user submissions.
db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_options_user
     ON poll_options (poll_id, submitted_by) WHERE submitted_by IS NOT NULL`
);

// Polls only name class updates for now (the API changes page has no name
// display); the kind column stays so the scope can grow later.
export const POLL_KINDS = ['class'];
export const POLL_TITLE_MAX = 50;
export const POLL_NAME_MIN = 2;
export const POLL_NAME_MAX = 50;
export const POLL_OPTIONS_MAX = 10;

export function isValidPollName(name) {
    const text = String(name || '').trim();
    return text.length >= POLL_NAME_MIN && text.length <= POLL_NAME_MAX ? text : null;
}

function pollRow(id) {
    return db.prepare('SELECT * FROM polls WHERE id = ?').get(Number(id)) || null;
}

function pollOptions(pollId, myVoteOptionId) {
    const rows = db
        .prepare(
            `SELECT o.id, o.name, o.submitted_by, o.created_at, COUNT(v.user_id) AS votes
             FROM poll_options o
             LEFT JOIN poll_votes v ON v.option_id = o.id
             WHERE o.poll_id = ? AND o.removed = 0
             GROUP BY o.id
             ORDER BY votes DESC, o.id ASC`
        )
        .all(pollId);
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        submittedBy: row.submitted_by,
        createdAt: row.created_at,
        votes: row.votes,
        mine: row.id === myVoteOptionId,
    }));
}

function serializePoll(row, userId) {
    if (!row) return null;
    const myVote = userId
        ? db.prepare('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(row.id, userId)
        : null;
    const options = pollOptions(row.id, myVote ? myVote.option_id : null);
    const winner = row.winner_option_id ? options.find((option) => option.id === row.winner_option_id) : null;
    return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        status: row.status,
        runAt: row.run_at,
        winnerOptionId: row.winner_option_id,
        winnerName: winner ? winner.name : null,
        createdBy: row.created_by,
        createdAt: row.created_at,
        closedAt: row.closed_at,
        options,
        myVoteOptionId: myVote ? myVote.option_id : null,
        totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    };
}

// Open polls first (newest first), then closed ones (newest first).
export function listPolls({ userId = null } = {}) {
    const rows = db.prepare("SELECT * FROM polls ORDER BY status = 'open' DESC, id DESC").all();
    return rows.map((row) => serializePoll(row, userId));
}

export function getPoll(id, userId = null) {
    return serializePoll(pollRow(id), userId);
}

export function createPoll({ title, kind = 'class', runAt = null, createdBy = null, options = [] }) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle || cleanTitle.length > POLL_TITLE_MAX) return { error: 'invalid-title' };
    if (!POLL_KINDS.includes(kind)) return { error: 'invalid-kind' };
    const cleanRunAt = typeof runAt === 'string' && runAt.trim() ? runAt.trim().slice(0, 40) : null;
    const names = [];
    for (const raw of Array.isArray(options) ? options : []) {
        const name = isValidPollName(raw);
        if (!name) continue;
        if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;
        names.push(name);
        if (names.length >= POLL_OPTIONS_MAX) break;
    }

    const info = db
        .prepare('INSERT INTO polls (title, kind, run_at, created_by) VALUES (?, ?, ?, ?)')
        .run(cleanTitle, kind, cleanRunAt, createdBy);
    const pollId = Number(info.lastInsertRowid);
    const insert = db.prepare('INSERT INTO poll_options (poll_id, name, submitted_by) VALUES (?, ?, NULL)');
    for (const name of names) insert.run(pollId, name);
    return { poll: getPoll(pollId, createdBy) };
}

export function addPollOption(pollId, name, submittedBy) {
    const poll = pollRow(pollId);
    if (!poll) return { error: 'not-found' };
    if (poll.status !== 'open') return { error: 'closed' };
    const clean = isValidPollName(name);
    if (!clean) return { error: 'invalid-name' };
    const duplicate = db
        .prepare('SELECT id FROM poll_options WHERE poll_id = ? AND removed = 0 AND lower(name) = lower(?)')
        .get(poll.id, clean);
    if (duplicate) return { error: 'duplicate' };
    try {
        db.prepare('INSERT INTO poll_options (poll_id, name, submitted_by) VALUES (?, ?, ?)').run(
            poll.id,
            clean,
            submittedBy
        );
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) return { error: 'already-suggested' };
        throw err;
    }
    return { poll: getPoll(poll.id, submittedBy) };
}

// A user withdraws their OWN suggested name (the UI adds a confirm step). The
// row is deleted outright so the one-suggestion slot frees up again; this is
// only allowed while the poll is open, and moderator removal (removePollOption)
// stays separate.
export function deleteOwnPollOption(pollId, optionId, userId) {
    const poll = pollRow(pollId);
    if (!poll) return { error: 'not-found' };
    const option = db
        .prepare('SELECT id, submitted_by FROM poll_options WHERE id = ? AND poll_id = ? AND removed = 0')
        .get(Number(optionId), poll.id);
    if (!option) return { error: 'invalid-option' };
    if (!option.submitted_by || option.submitted_by !== userId) return { error: 'forbidden' };
    if (poll.status !== 'open') return { error: 'closed' };
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ?').run(poll.id, option.id);
    db.prepare('DELETE FROM poll_options WHERE id = ?').run(option.id);
    if (poll.winner_option_id === option.id) {
        db.prepare('UPDATE polls SET winner_option_id = NULL WHERE id = ?').run(poll.id);
    }
    return { poll: getPoll(poll.id, userId) };
}

export function votePoll(pollId, optionId, userId) {
    const poll = pollRow(pollId);
    if (!poll) return { error: 'not-found' };
    if (poll.status !== 'open') return { error: 'closed' };
    const option = db
        .prepare('SELECT id FROM poll_options WHERE id = ? AND poll_id = ? AND removed = 0')
        .get(Number(optionId), poll.id);
    if (!option) return { error: 'invalid-option' };
    db.prepare(
        `INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)
         ON CONFLICT(poll_id, user_id) DO UPDATE SET option_id = excluded.option_id, created_at = datetime('now')`
    ).run(poll.id, option.id, userId);
    return { poll: getPoll(poll.id, userId) };
}

// Closes the poll with `winnerOptionId` (validated against its options). With
// no explicit winner the top-voted option wins; ties go to the earliest
// option. Returns the closed poll.
export function closePoll(id, winnerOptionId = null) {
    const poll = pollRow(id);
    if (!poll) return { error: 'not-found' };
    let winner = null;
    if (winnerOptionId != null) {
        winner = db
            .prepare('SELECT id FROM poll_options WHERE id = ? AND poll_id = ? AND removed = 0')
            .get(Number(winnerOptionId), poll.id);
        if (!winner) return { error: 'invalid-option' };
    } else {
        winner = db
            .prepare(
                `SELECT o.id, COUNT(v.user_id) AS votes
                 FROM poll_options o
                 LEFT JOIN poll_votes v ON v.option_id = o.id
                 WHERE o.poll_id = ? AND o.removed = 0
                 GROUP BY o.id
                 ORDER BY votes DESC, o.id ASC
                 LIMIT 1`
            )
            .get(poll.id);
    }
    db.prepare(
        "UPDATE polls SET status = 'closed', closed_at = datetime('now'), winner_option_id = ? WHERE id = ?"
    ).run(winner ? winner.id : null, poll.id);
    return { poll: getPoll(poll.id) };
}

export function reopenPoll(id) {
    const poll = pollRow(id);
    if (!poll) return { error: 'not-found' };
    db.prepare("UPDATE polls SET status = 'open', closed_at = NULL WHERE id = ?").run(poll.id);
    return { poll: getPoll(poll.id) };
}

export function deletePoll(id) {
    const poll = pollRow(id);
    if (!poll) return { error: 'not-found' };
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ?').run(poll.id);
    db.prepare('DELETE FROM poll_options WHERE poll_id = ?').run(poll.id);
    db.prepare('DELETE FROM polls WHERE id = ?').run(poll.id);
    return { ok: true };
}

export function removePollOption(pollId, optionId) {
    const poll = pollRow(pollId);
    if (!poll) return { error: 'not-found' };
    const option = db
        .prepare('SELECT id FROM poll_options WHERE id = ? AND poll_id = ? AND removed = 0')
        .get(Number(optionId), poll.id);
    if (!option) return { error: 'invalid-option' };
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ?').run(poll.id, option.id);
    db.prepare('UPDATE poll_options SET removed = 1 WHERE id = ?').run(option.id);
    if (poll.winner_option_id === option.id) {
        db.prepare('UPDATE polls SET winner_option_id = NULL WHERE id = ?').run(poll.id);
    }
    return { poll: getPoll(poll.id) };
}

// The winning names of closed, run-attached polls, keyed by the run timestamp:
// { class: { '<at>': 'Name' } }. The class changes page uses this to label
// each update run with its community-chosen name.
export function listUpdateNames() {
    const rows = db
        .prepare(
            `SELECT p.kind, p.run_at, o.name
             FROM polls p
             JOIN poll_options o ON o.id = p.winner_option_id
             WHERE p.status = 'closed' AND p.run_at IS NOT NULL`
        )
        .all();
    const names = { class: {} };
    for (const row of rows) {
        if (!names[row.kind]) names[row.kind] = {};
        names[row.kind][row.run_at] = row.name;
    }
    return names;
}

// Recent recorded class update runs, for the moderation page's "attach to
// run" picker. Reads the public history file directly (same file the class
// changes page renders); returns { class: [...] } newest first with the total
// number of recorded changes per run.
export function listRecentRuns(limit = 12) {
    const read = (file) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'items', file), 'utf8'));
        } catch (err) {
            return null;
        }
    };
    const classHistory = read('class-history.json');
    const classRuns = ((classHistory && classHistory.runs) || []).slice(0, limit).map((run) => ({
        at: run.at,
        total:
            (run.classes?.added?.length || 0) +
            (run.classes?.changed?.length || 0) +
            (run.classes?.removed?.length || 0) +
            (run.skills?.added?.length || 0) +
            (run.skills?.changed?.length || 0) +
            (run.skills?.removed?.length || 0) +
            (run.specs?.added?.length || 0) +
            (run.specs?.changed?.length || 0) +
            (run.specs?.removed?.length || 0),
    }));
    return { class: classRuns };
}
