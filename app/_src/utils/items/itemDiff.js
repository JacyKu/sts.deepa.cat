// Item diff helpers shared by the item stat history page and the API changes
// page. Pure functions: no React, no browser APIs.

import { statSnapshot } from './statFormatter';

const TOP_LEVEL_TEXT_KEYS = ['type', 'tier', 'region', 'location', 'base_item', 'original_item'];
const COMPLEX_KEYS = ['lore', 'mmlore', 'effects'];

export function numericValue(value) {
    if (typeof value === 'number') return value;
    if (value !== null && typeof value === 'object' && 'value' in value && typeof value.value === 'number') {
        return value.value;
    }
    return NaN;
}

// Item objects from two dumps may carry object-typed values (e.g.
// { value: 5 }); compare by stable shape rather than raw identity.
export function valueKey(value) {
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

// Every stat of the newer state, with the changed/added/removed ones marked
// and unchanged ones kept as 'same'. Sorted in the item display order
// (enchants, curses, attributes, base stats; alphabetical within a group),
// so the list reads exactly like the item's stat block.
function statLines(beforeItem, afterItem) {
    const beforeSnap = statSnapshot(beforeItem && beforeItem.stats, beforeItem && beforeItem.statColors);
    const afterSnap = statSnapshot(afterItem && afterItem.stats, afterItem && afterItem.statColors);
    const names = [...new Set([...beforeSnap.keys(), ...afterSnap.keys()])];
    const lines = [];
    for (const name of names) {
        const old = beforeSnap.get(name);
        const fresh = afterSnap.get(name);
        if (!old && fresh) {
            lines.push({ name, kind: 'added', fresh });
        } else if (old && !fresh) {
            lines.push({ name, kind: 'removed', old });
        } else if (old && fresh && valueKey(old.rawValue) !== valueKey(fresh.rawValue)) {
            const beforeNum = numericValue(old.rawValue);
            const afterNum = numericValue(fresh.rawValue);
            const rawDelta = afterNum - beforeNum;
            lines.push({
                name,
                kind: 'changed',
                old,
                fresh,
                // Round so floating point noise (2.3000000000000007) never
                // reaches the UI.
                delta: Number.isFinite(rawDelta) ? Math.round(rawDelta * 100) / 100 : NaN,
            });
        } else if (old && fresh) {
            lines.push({ name, kind: 'same', fresh });
        }
    }
    lines.sort((a, b) => {
        const rankA = (a.fresh || a.old).rank;
        const rankB = (b.fresh || b.old).rank;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
    });
    return lines;
}

// Per-stat differences between two item states: added / removed / changed
// lines (with the delta when both sides are numeric).
export function diffStats(beforeItem, afterItem) {
    return statLines(beforeItem, afterItem).filter((line) => line.kind !== 'same');
}

// The full stat list of the newer state: every stat, with changes marked and
// unchanged stats kept so it is clear what the item actually has.
export function allStatLines(beforeItem, afterItem) {
    return statLines(beforeItem, afterItem);
}

// Human-readable label for an item data field (base_item -> "Base item").
const FIELD_LABELS = { base_item: 'Base item', mmlore: 'MM lore', original_item: 'Original item' };

export function humanizeField(key) {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    const words = String(key).replaceAll('_', ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

// Differences in the plain text fields (type, tier, region, ...) and a
// flag for the complex fields (lore etc.) that changed without a line diff.
export function topLevelDiffs(beforeItem, afterItem) {
    if (!beforeItem || !afterItem) return [];
    const out = [];
    for (const key of TOP_LEVEL_TEXT_KEYS) {
        const oldV = beforeItem[key];
        const newV = afterItem[key];
        if (oldV === undefined && newV === undefined) continue;
        if (String(oldV ?? '') !== String(newV ?? '')) {
            out.push({ key, old: String(oldV ?? ''), fresh: String(newV ?? '') });
        }
    }
    for (const key of COMPLEX_KEYS) {
        const hasOld = key in beforeItem;
        const hasNew = key in afterItem;
        const equal = hasOld && hasNew ? JSON.stringify(beforeItem[key]) === JSON.stringify(afterItem[key]) : false;
        if ((hasOld || hasNew) && !equal) out.push({ key, complex: true });
    }
    return out;
}
