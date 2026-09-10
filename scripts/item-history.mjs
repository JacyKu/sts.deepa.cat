// Archive helpers for item stat history.
//
// items.json is overwritten wholesale every time update-items.mjs fetches a
// fresh dump from the Monumenta API. Any stat change would otherwise be lost
// silently. This module diffs the outgoing items.json against the incoming
// one and appends each changed/removed item's PREVIOUS state to
// public/items/item-history.json, so the site can show "this item used to
// be X" timelines.
//
// File shape:
//   {
//     updatedAt: <ISO>,            // last time an archive run happened
//     runs: [
//       { at: <ISO>, added: [keys], removed: [keys], changed: [keys] },
//       ...
//     ],
//     items: {
//       "<item key>": [            // newest archive first
//         { at: <ISO>, item: <full pre-change item object> },
//         ...
//       ]
//     }
//   }
//
// Runs are bounded to the last 200 so the file doesn't grow forever with
// run bookkeeping (the per-item archives themselves are kept in full).

const MAX_RUNS = 200;

// Stable deep equality: property insertion order may differ between two
// dumps of the same logical item, so compare canonically key-sorted objects.
function sortify(value) {
    if (Array.isArray(value)) return value.map(sortify);
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value).sort()) out[key] = sortify(value[key]);
        return out;
    }
    return value;
}

export function deepEqualStable(a, b) {
    return JSON.stringify(sortify(a)) === JSON.stringify(sortify(b));
}

// Fields that don't represent a gameplay change: statColors is display-only
// metadata attached at import time, nbt is stripped before writing. Ignoring
// them keeps color-only updates out of the archive.
const IGNORED_COMPARE_FIELDS = ['statColors', 'nbt'];

function withoutIgnored(item) {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    for (const field of IGNORED_COMPARE_FIELDS) delete copy[field];
    return copy;
}

function loadHistory(raw) {
    if (!raw) return { updatedAt: null, runs: [], items: {} };
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { updatedAt: null, runs: [], items: {} };
        return {
            updatedAt: parsed.updatedAt ?? null,
            runs: Array.isArray(parsed.runs) ? parsed.runs : [],
            items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
        };
    } catch (err) {
        return { updatedAt: null, runs: [], items: {} };
    }
}

// Merges a fresh item dump into the history file. Returns
// { raw, summary } where raw is the JSON string to persist (null when nothing
// changed) and summary describes what happened for logging.
export function mergeHistory(historyRaw, currentItems, nextItems, now = new Date().toISOString()) {
    const history = loadHistory(historyRaw);
    const changed = [];
    const removed = [];
    const added = [];

    const currentKeys = new Set(Object.keys(currentItems || {}));
    const nextKeys = new Set(Object.keys(nextItems || {}));

    for (const key of currentKeys) {
        if (!nextKeys.has(key)) {
            removed.push(key);
            continue;
        }
        if (!deepEqualStable(withoutIgnored(currentItems[key]), withoutIgnored(nextItems[key]))) {
            changed.push(key);
        }
    }
    for (const key of nextKeys) {
        if (!currentKeys.has(key)) added.push(key);
    }

    if (changed.length === 0 && removed.length === 0) {
        return {
            raw: null,
            summary: { changed: [], removed: [], added },
            history,
        };
    }

    const entries = [...changed, ...removed];
    for (const key of entries) {
        const list = history.items[key] || [];
        list.unshift({ at: now, item: currentItems[key] });
        history.items[key] = list;
    }

    history.runs.unshift({ at: now, added, removed, changed });
    if (history.runs.length > MAX_RUNS) history.runs.length = MAX_RUNS;
    history.updatedAt = now;

    return {
        raw: JSON.stringify(history),
        summary: { changed, removed, added },
        history,
    };
}
