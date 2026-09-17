'use client';

import React from 'react';
import styles from '../../styles/History.module.css';
import DiffLine from './itemDiffLine';
import { useItemHistory } from './itemHistoryContext';
import { formatDateString } from '../../utils/dateFormat';
import { diffStats, topLevelDiffs, humanizeField } from '../../utils/items/itemDiff';
import { useTranslation } from '../useTranslation';

// One archived change: the date plus every stat / field that differs from the
// state after it (the next newer record, or the current item).
function VersionRow({ record, afterItem }) {
    const t = useTranslation();
    const statLines = diffStats(record.item, afterItem);
    const topLines = topLevelDiffs(record.item, afterItem);
    if (statLines.length === 0 && topLines.length === 0) return null;
    return (
        <div className={styles.versionRow}>
            <div className={styles.versionHead}>
                <span className={styles.versionDate}>{formatDateString(record.at)}</span>
            </div>
            {statLines.map((line) => (
                <DiffLine key={'stat-' + line.name} line={line} />
            ))}
            {topLines.map((line, i) =>
                line.complex ? (
                    <div key={`top-${i}`} className={styles.complexLine}>
                        {humanizeField(line.key)} {t('items.history.changed')}
                    </div>
                ) : (
                    <div key={`top-${i}`} className={styles.complexLine}>
                        {humanizeField(line.key)}: {line.old} → {line.fresh}
                    </div>
                )
            )}
        </div>
    );
}

// Per-item stat history, rendered inside the item tiles on the items page.
// Collapsed to a one-line summary until clicked, and nothing at all for items
// that never changed.
export default function ItemHistoryPanel({ records, currentItem }) {
    const t = useTranslation();
    const { enabled: historyEnabled } = useItemHistory();
    const [open, setOpen] = React.useState(false);
    if (!historyEnabled || !records || records.length === 0) return null;

    // Records are newest-first in the file; render oldest-first so the newest
    // state sits at the bottom (right above "current stats").
    const sorted = [...records].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const changeCount = sorted.length;
    const lastAt = records[0].at;

    return (
        <div className={styles.itemHistory}>
            <button
                type="button"
                className={styles.itemHistoryToggle}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span>
                    {changeCount} {changeCount === 1 ? t('items.history.change') : t('items.history.changes')} ·{' '}
                    {t('items.history.last')} {formatDateString(lastAt)}
                </span>
                <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
                    ▸
                </span>
            </button>
            {open && (
                <div className={styles.timeline}>
                    {sorted.map((record, i) => {
                        const newerState = i < sorted.length - 1 ? sorted[i + 1].item : currentItem;
                        return <VersionRow key={record.at + '-' + i} record={record} afterItem={newerState} />;
                    })}
                    <div className={styles.currentRow}>
                        <span className={styles.currentBadge}>{t('items.history.currentStats')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
