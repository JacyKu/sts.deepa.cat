import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepEqualStable } from './item-history.mjs';

// Archive helpers for class (skill/spec/passive) data.
//
// public/items/skills.json is overwritten wholesale every time the class data
// is fetched from the Monumenta API (/skills). Any difference would otherwise
// be lost silently. This module diffs the outgoing skills.json against the
// incoming one and appends the PREVIOUS state of every changed/removed class,
// skill and spec to public/items/class-history.json, so the site can render a
// dated "class changes" changelog (new / changed / removed entries with the
// exact field differences).
//
// File shape:
//   {
//     updatedAt: <ISO>,                // last time an archive run happened
//     runs: [                          // newest first
//       {
//         at: <ISO>,
//         classes: { added: [name], removed: [name], changed: [name] },
//         skills:  { added: [key],  removed: [key],  changed: [key]  },
//         specs:   { added: [name], removed: [name], changed: [name] },
//       },
//       ...
//     ],
//     classes: { "<className>": [ { at, class: <pre-change shell> } ] },
//     skills:  { "<skillKey>":  [ { at, class, spec, skill } ] },
//     specs:   { "<specName>":  [ { at, class, spec } ] },
//   }
//
// Skill keys are the API's scoreboardId (globally unique); specs are keyed by
// specName. Passives live inside their class shell. Runs are kept forever so
// every recorded class change stays viewable.
//
// formattedDescriptions (the pre-rendered chat JSON) is derived display data:
// the API can re-format it without any gameplay change, so it is ignored when
// comparing. It is still written to skills.json untouched.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SKILLS_TARGET = path.join(ROOT, 'public', 'items', 'skills.json');
const HISTORY_TARGET = path.join(ROOT, 'public', 'items', 'class-history.json');
// Timestamped copies of the outgoing history are kept here before every
// rewrite, so an accidental loss (deleted file, bad write) can be recovered.
const BACKUPS_DIR = path.join(ROOT, 'public', 'items', 'backups');
const HISTORY_BACKUPS_KEPT = 10;

const SKILLS_URL = 'https://api.playmonumenta.com/skills';
const MIN_CLASSES = 8;

// The archive record for a skill/spec/class wrapper, with the derived
// formattedDescriptions removed (shallow: only the fields we compare).
function stripFormatted(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const { formattedDescriptions, ...rest } = obj;
    return rest;
}

function withoutIgnored(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    const copy = { ...entry };
    if (copy.skill) copy.skill = stripFormatted(copy.skill);
    if (copy.classPassive) copy.classPassive = stripFormatted(copy.classPassive);
    return copy;
}

function skillKey(skill) {
    if (!skill || typeof skill !== 'object') return null;
    if (typeof skill.scoreboardId === 'string' && skill.scoreboardId) return skill.scoreboardId;
    if (typeof skill.name === 'string' && skill.name) return skill.name;
    return null;
}

// Flattens one skills.json payload into the entities the archive tracks:
//   classes: className -> { classId, className, classPassive }
//   skills:  scoreboardId -> { class: className, spec: specName|null, skill }
//   specs:   specName -> { class: className, spec: { specId, specName, specQuestScore } }
function flattenClassData(payload) {
    const classes = new Map();
    const skills = new Map();
    const specs = new Map();
    for (const cls of (payload && payload.classes) || []) {
        if (!cls || typeof cls.className !== 'string' || !cls.className) continue;
        classes.set(cls.className, {
            classId: cls.classId,
            className: cls.className,
            classPassive: cls.classPassive,
        });
        for (const skill of cls.skills || []) {
            const key = skillKey(skill);
            if (key) skills.set(key, { class: cls.className, spec: null, skill });
        }
        for (const spec of cls.specs || []) {
            if (!spec || typeof spec.specName !== 'string' || !spec.specName) continue;
            specs.set(spec.specName, {
                class: cls.className,
                spec: { specId: spec.specId, specName: spec.specName, specQuestScore: spec.specQuestScore },
            });
            for (const skill of spec.specSkills || []) {
                const key = skillKey(skill);
                if (key) skills.set(key, { class: cls.className, spec: spec.specName, skill });
            }
        }
    }
    return { classes, skills, specs };
}

function loadHistory(raw) {
    if (!raw) return { updatedAt: null, runs: [], classes: {}, skills: {}, specs: {} };
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return { updatedAt: null, runs: [], classes: {}, skills: {}, specs: {} };
        return {
            updatedAt: parsed.updatedAt ?? null,
            runs: Array.isArray(parsed.runs) ? parsed.runs : [],
            classes: parsed.classes && typeof parsed.classes === 'object' ? parsed.classes : {},
            skills: parsed.skills && typeof parsed.skills === 'object' ? parsed.skills : {},
            specs: parsed.specs && typeof parsed.specs === 'object' ? parsed.specs : {},
        };
    } catch (err) {
        return { updatedAt: null, runs: [], classes: {}, skills: {}, specs: {} };
    }
}

function diffGroup(currentMap, nextMap) {
    const added = [];
    const removed = [];
    const changed = [];
    for (const key of currentMap.keys()) {
        if (!nextMap.has(key)) {
            removed.push(key);
            continue;
        }
        if (!deepEqualStable(withoutIgnored(currentMap.get(key)), withoutIgnored(nextMap.get(key)))) {
            changed.push(key);
        }
    }
    for (const key of nextMap.keys()) {
        if (!currentMap.has(key)) added.push(key);
    }
    added.sort();
    removed.sort();
    changed.sort();
    return { added, removed, changed };
}

function groupSize(group) {
    return group.added.length + group.removed.length + group.changed.length;
}

// Merges a fresh class data payload into the history file. Returns
// { raw, summary } where raw is the JSON string to persist (null when nothing
// changed) and summary describes what happened for logging.
export function mergeClassHistory(historyRaw, currentData, nextData, now = new Date().toISOString()) {
    const history = loadHistory(historyRaw);
    const current = flattenClassData(currentData);
    const next = flattenClassData(nextData);

    const classes = diffGroup(current.classes, next.classes);
    const skills = diffGroup(current.skills, next.skills);
    const specs = diffGroup(current.specs, next.specs);
    const total = groupSize(classes) + groupSize(skills) + groupSize(specs);
    const summary = { classes, skills, specs, total };

    if (total === 0) return { raw: null, summary, history };

    // The archive keeps the state BEFORE the run: for a changed/removed entry
    // that is the state we are about to overwrite. Added entries have no
    // previous state to keep (their name/class come from the live data or a
    // later archive record on the changes page).
    const archive = (bucket, key, record) => {
        const list = history[bucket][key] || [];
        list.unshift({ at: now, ...record });
        history[bucket][key] = list;
    };
    for (const key of [...classes.changed, ...classes.removed]) {
        archive('classes', key, { class: withoutIgnored(current.classes.get(key)) });
    }
    for (const key of [...skills.changed, ...skills.removed]) {
        archive('skills', key, withoutIgnored(current.skills.get(key)));
    }
    for (const key of [...specs.changed, ...specs.removed]) {
        archive('specs', key, current.specs.get(key));
    }

    history.runs.unshift({ at: now, classes, skills, specs });
    history.updatedAt = now;

    return { raw: JSON.stringify(history), summary, history };
}

// Fetches and validates the live class data. The payload is the same
// /skills document skills.json is built from.
export async function fetchClassData() {
    const res = await fetch(SKILLS_URL);
    if (!res.ok) throw new Error(`skills API: HTTP ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw);

    if (!data || !Array.isArray(data.classes) || data.classes.length < MIN_CLASSES) {
        throw new Error(`skills payload missing classes array (expected at least ${MIN_CLASSES})`);
    }
    for (const cls of data.classes) {
        if (!cls.className || !Array.isArray(cls.skills)) {
            throw new Error('skills payload has an unexpected class shape');
        }
    }
    return { data, raw };
}

async function writeFileAtomic(target, contents) {
    const tmp = target + '.tmp';
    await fs.writeFile(tmp, contents);
    await fs.rename(tmp, target);
}

async function backupHistoryFile() {
    try {
        const existing = await fs.readFile(HISTORY_TARGET, 'utf8');
        if (!existing.trim()) return;
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.writeFile(path.join(BACKUPS_DIR, `class-history-${stamp}.json`), existing);
        const backups = (await fs.readdir(BACKUPS_DIR))
            .filter((name) => name.startsWith('class-history-') && name.endsWith('.json'))
            .sort();
        for (const name of backups.slice(0, Math.max(0, backups.length - HISTORY_BACKUPS_KEPT))) {
            await fs.rm(path.join(BACKUPS_DIR, name), { force: true });
        }
    } catch (err) {
        // First run (no history yet) or unreadable file - nothing to back up.
    }
}

function logSummary(summary, log) {
    const counts = (group) =>
        `${group.added.length} added, ${group.changed.length} changed, ${group.removed.length} removed`;
    log.info?.(`[classes-update] classes: ${counts(summary.classes)}`);
    log.info?.(`[classes-update] skills: ${counts(summary.skills)}`);
    log.info?.(`[classes-update] specs: ${counts(summary.specs)}`);
    for (const group of ['classes', 'skills', 'specs']) {
        for (const key of summary[group].changed.slice(0, 10)) log.info?.(`  changed: ${key}`);
        for (const key of summary[group].removed.slice(0, 10)) log.info?.(`  removed: ${key}`);
    }
}

// Fetches the live class data, archives the differences against the outgoing
// skills.json and writes both files. Used by scripts/update-classes.mjs (the
// update:classes command and the moderation "Classes" runner) and by
// scripts/update-items.mjs, whose weekly run also refreshes class data.
export async function updateClassData({ dryRun = false, log = console, now = new Date().toISOString() } = {}) {
    let currentRaw = null;
    try {
        currentRaw = await fs.readFile(SKILLS_TARGET, 'utf8');
    } catch (err) {
        currentRaw = null; // first run - no outgoing data to diff against
    }
    const current = currentRaw ? JSON.parse(currentRaw) : { classes: [] };

    log.info?.(`[classes-update] fetching ${SKILLS_URL}`);
    const { data: next, raw: nextRaw } = await fetchClassData();

    let historyRaw = null;
    try {
        historyRaw = await fs.readFile(HISTORY_TARGET, 'utf8');
    } catch (err) {
        historyRaw = null; // first run - the archive file doesn't exist yet
    }

    const { raw: historyNext, summary } = mergeClassHistory(historyRaw, current, next, now);

    if (summary.total === 0) {
        log.info?.('[classes-update] no class changes detected - history left unchanged');
        // Formatting-only differences still land, so display data can improve
        // without recording a change run.
        if (!dryRun && nextRaw !== currentRaw) {
            await writeFileAtomic(SKILLS_TARGET, nextRaw);
            log.info?.(`[classes-update] wrote ${path.relative(process.cwd(), SKILLS_TARGET)} (display data only)`);
        }
        return summary;
    }

    logSummary(summary, log);
    if (dryRun) {
        log.info?.('[classes-update] dry run - not writing');
        return summary;
    }

    if (historyNext) {
        await backupHistoryFile();
        await writeFileAtomic(HISTORY_TARGET, historyNext);
    }
    await writeFileAtomic(SKILLS_TARGET, nextRaw);
    log.info?.(`[classes-update] wrote ${path.relative(process.cwd(), SKILLS_TARGET)} and class-history.json`);
    return summary;
}

// Root of public/items as an absolute path (used by the CLI wrapper).
export const ITEMS_DIR = path.join(ROOT, 'public', 'items');
