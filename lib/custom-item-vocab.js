// Server-side vocabulary for custom items, derived from the site's item data
// (the same source the client's dropdowns are built from). The API routes
// coerce client input against these sets so a crafted request cannot store
// item types, base items or stat keys the builder/UI doesn't understand.

import { ITEM_TYPES } from '../app/_src/utils/customItemTypes.js';

// Types older items may still carry (the database filter keeps them so legacy
// rows stay filterable); new saves are restricted to the real vocabulary.
const LEGACY_ITEM_TYPES = ['Miscellaneous', 'Trinket'];
const ITEM_TYPE_SET = new Set([...ITEM_TYPES, ...LEGACY_ITEM_TYPES]);

const STAT_KEY_RE = /^[a-z0-9_']+$/;
const MAX_STAT_ENTRIES = 50;
const MAX_STAT_VALUE = 1e9;

export function buildCustomItemVocab(itemData) {
    const baseItems = new Set();
    const stats = new Set();
    for (const item of Object.values(itemData || {})) {
        const base = item && typeof item.base_item === 'string' ? item.base_item.trim() : '';
        if (base) baseItems.add(base);
        for (const key of Object.keys((item && item.stats) || {})) stats.add(key);
        for (const key of Object.keys((item && item.statColors) || {})) stats.add(key);
    }
    return { itemTypes: ITEM_TYPE_SET, baseItems, stats };
}

// Unknown types fall back to "Miscellaneous" (the default that was always
// stored for unrecognized input); unknown base items are dropped.
export function coerceItemType(type, vocab) {
    const value = typeof type === 'string' ? type.trim() : '';
    return vocab.itemTypes.has(value) ? value : 'Miscellaneous';
}

export function coerceBaseItem(baseItem, vocab) {
    const value = typeof baseItem === 'string' ? baseItem.trim() : '';
    return value && value.length <= 64 && vocab.baseItems.has(value) ? value : null;
}

// Sanitize a stats object: known keys only, finite non-zero numbers within a
// sane range, capped at 50 entries.
export function sanitizeItemStats(rawStats, vocab, maxEntries = MAX_STAT_ENTRIES) {
    const stats = {};
    if (!rawStats || typeof rawStats !== 'object') return stats;
    for (const [key, value] of Object.entries(rawStats)) {
        if (typeof key !== 'string' || key.length > 128 || !STAT_KEY_RE.test(key)) continue;
        if (vocab && !vocab.stats.has(key)) continue;
        const number = Number(value);
        if (!Number.isFinite(number) || number === 0 || Math.abs(number) > MAX_STAT_VALUE) continue;
        stats[key] = number;
        if (Object.keys(stats).length >= maxEntries) break;
    }
    return stats;
}
