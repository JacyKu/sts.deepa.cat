// Class change diff helpers shared by the /classes/changes page and its
// tests. Pure functions: no React, no browser APIs.
//
// The archive (public/items/class-history.json, written by
// scripts/update-classes.mjs) stores the state BEFORE each run for every
// changed/removed class, skill and specialization. This module turns those
// runs into display-ready groups with the exact field differences, and diffs
// two entity states for the change entries.
//
// Entity wrappers:
//   class: { classId, className, classPassive }
//   skill: { class, spec, skill }
//   spec:  { class, spec: { specId, specName, specQuestScore } }

// Fields compared per entity kind. The third item marks array-of-string
// fields: every element is its own line ("Level 1", "Trigger 2", ...).
const SKILL_FIELDS = [
    ['class', 'Class'],
    ['spec', 'Spec'],
    ['name', 'Name'],
    ['displayName', 'Display name'],
    ['shortName', 'Short name'],
    ['simpleDescription', 'Description'],
    ['extraDescription', 'Extra description'],
    ['actionBarColor', 'Action bar color'],
    ['triggers', 'Trigger', true],
    ['cooldowns', 'Cooldown', true],
    ['descriptions', 'Level', true],
];

const CLASS_FIELDS = [['classId', 'Class id']];

const CLASS_PASSIVE_FIELDS = [
    ['name', 'Passive name'],
    ['displayName', 'Passive display name'],
    ['extraDescription', 'Passive extra description'],
    ['actionBarColor', 'Passive action bar color'],
    ['triggers', 'Passive trigger', true],
    ['descriptions', 'Passive description', true],
];

const SPEC_FIELDS = [
    ['class', 'Class'],
    ['specQuestScore', 'Quest score'],
];

const FIELD_GROUPS = {
    class: [...CLASS_FIELDS, ...CLASS_PASSIVE_FIELDS],
    skill: SKILL_FIELDS,
    spec: SPEC_FIELDS,
};

function fieldValue(state, kind, field) {
    if (!state) return undefined;
    if (kind === 'class') {
        return CLASS_FIELDS.some(([key]) => key === field) ? state[field] : state.classPassive?.[field];
    }
    if (kind === 'spec') {
        return field === 'class' ? state.class : state.spec?.[field];
    }
    return field === 'class' ? state.class : field === 'spec' ? state.spec : state.skill?.[field];
}

// Whitespace in the API descriptions is alignment padding; comparing raw
// strings would flag every re-indented dump as a change. Line breaks are kept
// (the UI shows the text as written when something did change).
export function normalizeText(value) {
    if (value == null) return '';
    return String(value)
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();
}

function isDifferent(a, b) {
    return normalizeText(a) !== normalizeText(b);
}

function isMultiline(a, b) {
    const text = `${a ?? ''}${b ?? ''}`;
    return text.includes('\n') || text.length > 100;
}

function splitLines(value) {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''));
}

// Line-level diff for long text (descriptions, extra descriptions). With
// keepSame (the page's mode) the unchanged lines are kept too, so the whole
// text reads as a unified diff: context lines dimmed, removed lines marked
// with a minus, added lines with a plus. Lines compare by normalized text, so
// the API's alignment re-padding does not mark every line as changed.
export function textLineDiff(oldText, newText, { keepSame = false } = {}) {
    const oldLines = splitLines(oldText);
    const newLines = splitLines(newText);
    const n = oldLines.length;
    const m = newLines.length;
    // Longest common subsequence length table over the two line lists.
    const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            table[i][j] =
                normalizeText(oldLines[i]) === normalizeText(newLines[j])
                    ? table[i + 1][j + 1] + 1
                    : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    const rows = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (normalizeText(oldLines[i]) === normalizeText(newLines[j])) {
            if (keepSame) rows.push({ kind: 'same', text: oldLines[i] });
            i++;
            j++;
            continue;
        }
        if (table[i + 1][j] >= table[i][j + 1]) rows.push({ kind: 'removed', text: oldLines[i++] });
        else rows.push({ kind: 'added', text: newLines[j++] });
    }
    while (i < n) rows.push({ kind: 'removed', text: oldLines[i++] });
    while (j < m) rows.push({ kind: 'added', text: newLines[j++] });
    return rows;
}

// The line objects classDiffLines returns; multi-line values also carry the
// line-level diff rows the page renders.
function diffLine(base) {
    const line = { ...base, multiline: isMultiline(base.old, base.fresh) };
    if (line.multiline) line.rows = textLineDiff(line.old, line.fresh, { keepSame: true });
    return line;
}

// The differences between two entity states, as render-ready lines:
//   { key, label, kind: 'changed' | 'added' | 'removed', old, fresh, multiline }
// `kind` is the entity kind ('class' | 'skill' | 'spec').
export function classDiffLines(kind, before, after) {
    const fields = FIELD_GROUPS[kind] || [];
    const lines = [];
    for (const [field, label, isArray] of fields) {
        const oldValue = fieldValue(before, kind, field);
        const newValue = fieldValue(after, kind, field);
        const oldEmpty = oldValue == null || oldValue === '';
        const newEmpty = newValue == null || newValue === '';
        if (oldEmpty && newEmpty) continue;

        if (isArray) {
            const oldList = Array.isArray(oldValue) ? oldValue : [];
            const newList = Array.isArray(newValue) ? newValue : [];
            const length = Math.max(oldList.length, newList.length);
            for (let i = 0; i < length; i++) {
                const oldItem = oldList[i];
                const newItem = newList[i];
                if (oldItem === undefined && newItem === undefined) continue;
                if (oldItem !== undefined && newItem !== undefined && !isDifferent(oldItem, newItem)) continue;
                const itemKind = oldItem === undefined ? 'added' : newItem === undefined ? 'removed' : 'changed';
                lines.push(
                    diffLine({
                        key: `${kind}-${field}-${i}`,
                        label: `${label} ${i + 1}`,
                        kind: itemKind,
                        old: oldItem === undefined ? '' : String(oldItem),
                        fresh: newItem === undefined ? '' : String(newItem),
                    })
                );
            }
            continue;
        }

        if (!isDifferent(oldValue, newValue)) continue;
        lines.push(
            diffLine({
                key: `${kind}-${field}`,
                label,
                kind: 'changed',
                old: oldEmpty ? '' : String(oldValue),
                fresh: newEmpty ? '' : String(newValue),
            })
        );
    }
    return lines;
}

// Flattens one skills.json payload into the entities the archive tracks.
export function flattenClassData(payload) {
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
            const key = skill && (skill.scoreboardId || skill.name);
            if (key) skills.set(key, { class: cls.className, spec: null, skill });
        }
        for (const spec of cls.specs || []) {
            if (!spec || typeof spec.specName !== 'string' || !spec.specName) continue;
            specs.set(spec.specName, {
                class: cls.className,
                spec: { specId: spec.specId, specName: spec.specName, specQuestScore: spec.specQuestScore },
            });
            for (const skill of spec.specSkills || []) {
                const key = skill && (skill.scoreboardId || skill.name);
                if (key) skills.set(key, { class: cls.className, spec: spec.specName, skill });
            }
        }
    }
    return { classes, skills, specs };
}

// The stored archive record for a run (runs record the state before the run,
// so the entry we want is exactly the one stamped with the run's `at`).
function recordAt(records, at) {
    if (!Array.isArray(records) || records.length === 0) return null;
    return records.find((record) => record.at === at) || records[0];
}

// Before/after for a changed key: the archive state at the run plus the next
// newer archive record, falling back to the live data for the newest run.
function resolveChange(records, at, live, wrap) {
    if (!Array.isArray(records) || records.length === 0) return null;
    const sorted = [...records].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const index = sorted.findIndex((record) => record.at === at);
    if (index < 0) return null;
    const before = wrap(sorted[index]);
    const after = index + 1 < sorted.length ? wrap(sorted[index + 1]) : live || null;
    if (!before || !after) return null;
    return { before, after };
}

function classWrap(record) {
    return record && record.class ? record.class : null;
}

function skillWrap(record) {
    return record && record.skill ? { class: record.class, spec: record.spec ?? null, skill: record.skill } : null;
}

function specWrap(record) {
    return record && record.spec ? { class: record.class, spec: record.spec } : null;
}

function classEntry(wrapper, key) {
    return wrapper ? { key, name: wrapper.className || key, classId: wrapper.classId } : { key, name: key };
}

function skillEntry(wrapper, key) {
    return wrapper
        ? { key, name: (wrapper.skill && wrapper.skill.name) || key, class: wrapper.class, spec: wrapper.spec || null }
        : { key, name: key, class: null, spec: null };
}

function specEntry(wrapper, key) {
    return wrapper
        ? { key, name: (wrapper.spec && wrapper.spec.specName) || key, class: wrapper.class }
        : { key, name: key, class: null };
}

// Turns the recorded runs into display-ready groups: for each run the added,
// changed (with both states) and removed classes, skills and specs. Runs with
// nothing to show are dropped.
export function buildClassRunGroups(history, classData) {
    const live = flattenClassData(classData || { classes: [] });
    const runs = Array.isArray(history && history.runs) ? history.runs : [];
    const classArchives = (history && history.classes) || {};
    const skillArchives = (history && history.skills) || {};
    const specArchives = (history && history.specs) || {};

    const group = (source, at, archives, liveMap, wrap, makeEntry) => {
        const state = source && typeof source === 'object' ? source : {};
        const added = (state.added || [])
            .map((key) => makeEntry(liveMap.get(key) || wrap(recordAt(archives[key], at)), key))
            .filter(Boolean);
        const removed = (state.removed || [])
            .map((key) => makeEntry(wrap(recordAt(archives[key], at)), key))
            .filter(Boolean);
        const changed = (state.changed || [])
            .map((key) => {
                const resolved = resolveChange(archives[key], at, liveMap.get(key), wrap);
                if (!resolved) return null;
                const entry = makeEntry(resolved.after, key);
                return entry && { ...entry, before: resolved.before, after: resolved.after };
            })
            .filter(Boolean);
        return { added, removed, changed };
    };

    return runs
        .map((run) => ({
            at: run.at,
            classes: group(run.classes, run.at, classArchives, live.classes, classWrap, classEntry),
            skills: group(run.skills, run.at, skillArchives, live.skills, skillWrap, skillEntry),
            specs: group(run.specs, run.at, specArchives, live.specs, specWrap, specEntry),
        }))
        .map((run) => ({
            ...run,
            changedCount: run.classes.changed.length + run.skills.changed.length + run.specs.changed.length,
            addedCount: run.classes.added.length + run.skills.added.length + run.specs.added.length,
            removedCount: run.classes.removed.length + run.skills.removed.length + run.specs.removed.length,
        }))
        .filter((run) => run.changedCount + run.addedCount + run.removedCount > 0);
}
