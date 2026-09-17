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

// Per-stat differences between two item states: added / removed / changed
// lines, with the delta when both sides are numeric.
export function diffStats(beforeItem, afterItem) {
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
            lines.push({
                name,
                kind: 'changed',
                old,
                fresh,
                delta: !Number.isNaN(beforeNum) && !Number.isNaN(afterNum) ? afterNum - beforeNum : NaN,
            });
        }
    }
    return lines;
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
