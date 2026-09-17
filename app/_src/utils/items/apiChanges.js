// Turns the recorded API runs (item-history.json) into display-ready groups:
// for every run the added items, the changed items with both item states (so
// the UI can render stat differences), and the removed items. Pure so it can
// be exercised from Node without a browser.

function archivedItem(archives, key, at) {
    const records = archives[key];
    if (!Array.isArray(records) || records.length === 0) return null;
    const exact = records.find((record) => record.at === at);
    return (exact || records[0]).item || null;
}

export function buildRunGroups(history, itemData) {
    const runs = Array.isArray(history && history.runs) ? history.runs : [];
    const archives = history && history.items && typeof history.items === 'object' ? history.items : {};
    const items = itemData && typeof itemData === 'object' ? itemData : {};

    return runs
        .map((run) => {
            const at = run.at;
            const added = (run.added || []).map((key) => {
                const item = items[key] || archivedItem(archives, key, at);
                return { key, item, name: (item && item.name) || key };
            });
            const changed = (run.changed || [])
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
                    return { key, name: (item && item.name) || key, before, after, item };
                })
                .filter((entry) => entry.before && entry.after);
            const removed = (run.removed || []).map((key) => {
                const item = archivedItem(archives, key, at);
                return { key, item, name: (item && item.name) || key };
            });
            return { at, added, changed, removed };
        })
        .filter((run) => run.added.length > 0 || run.changed.length > 0 || run.removed.length > 0);
}
