// Turns the recorded API runs (item-history.json) into display-ready groups:
// for every run the added items, the changed items with both item states (so
// the UI can render stat differences), and the removed items. Masterwork
// variants of one item are combined under a single entry with a variant per
// masterwork level, which the page switches between with the item tiles' star
// switcher. Pure so it can be exercised from Node without a browser.

import { diffStats, topLevelDiffs } from './itemDiff';

// True when the only difference between two item states is flavour text (the
// lore/description fields): no stat changed and no plain field changed. The
// changes page hides these entries by default - they are not balance changes -
// and reveals them with a toggle.
function isLoreOnlyChange(before, after) {
    if (!before || !after) return false;
    if (diffStats(before, after).length > 0) return false;
    const top = topLevelDiffs(before, after);
    return top.length > 0 && top.every((line) => line.complex);
}

function archivedItem(archives, key, at) {
    const records = archives[key];
    if (!Array.isArray(records) || records.length === 0) return null;
    const exact = records.find((record) => record.at === at);
    return (exact || records[0]).item || null;
}

// One chip per item name, even when several masterwork variants changed.
function dedupeByName(entries) {
    const seen = new Map();
    for (const entry of entries) {
        if (!seen.has(entry.name)) seen.set(entry.name, entry);
    }
    return [...seen.values()];
}

export function buildRunGroups(history, itemData) {
    const runs = Array.isArray(history && history.runs) ? history.runs : [];
    const archives = history && history.items && typeof history.items === 'object' ? history.items : {};
    const items = itemData && typeof itemData === 'object' ? itemData : {};

    return runs
        .map((run) => {
            const at = run.at;
            const added = dedupeByName(
                (run.added || []).map((key) => {
                    const item = items[key] || archivedItem(archives, key, at);
                    return { key, item, name: (item && item.name) || key };
                })
            );
            const changedEntries = (run.changed || [])
                .map((key) => {
                    // The archive records the state BEFORE each run. The state
                    // after a run is the next newer record, or the live item.
                    const records = [...(archives[key] || [])].sort((a, b) =>
                        String(a.at).localeCompare(String(b.at))
                    );
                    const index = records.findIndex((record) => record.at === at);
                    const before = index >= 0 ? records[index].item : null;
                    const after =
                        index >= 0 && index + 1 < records.length ? records[index + 1].item : items[key] || null;
                    const item = after || before;
                    return { key, name: (item && item.name) || key, before, after, item, loreOnly: isLoreOnlyChange(before, after) };
                })
                .filter((entry) => entry.before && entry.after);

            const changedGroups = new Map();
            for (const entry of changedEntries) {
                const group = changedGroups.get(entry.name) || { name: entry.name, variants: [] };
                group.variants.push({
                    key: entry.key,
                    masterwork: Number(entry.item && entry.item.masterwork) || 0,
                    before: entry.before,
                    after: entry.after,
                    item: entry.item,
                    loreOnly: entry.loreOnly,
                });
                changedGroups.set(entry.name, group);
            }
            const changed = [...changedGroups.values()].map((group) => ({
                ...group,
                // An entry is lore-only when every masterwork variant only had
                // its lore/description text touched.
                loreOnly: group.variants.every((v) => v.loreOnly),
                variants: group.variants.sort((a, b) => a.masterwork - b.masterwork),
            }));

            const removed = dedupeByName(
                (run.removed || []).map((key) => {
                    const item = archivedItem(archives, key, at);
                    return { key, item, name: (item && item.name) || key };
                })
            );
            return { at, added, changed, removed };
        })
        .filter((run) => run.added.length > 0 || run.changed.length > 0 || run.removed.length > 0);
}
