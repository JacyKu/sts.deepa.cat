'use client';

import React from 'react';
import Link from 'next/link';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import HistoryIcon from './historyIcon';
import DiffLine from './itemDiffLine';
import { formatDateString } from '../../utils/dateFormat';
import { buildRunGroups } from '../../utils/items/apiChanges';
import { diffStats, topLevelDiffs } from '../../utils/items/itemDiff';
import { useTranslation } from '../useTranslation';

function wikiHref(name) {
    return `https://monumenta.wiki.gg/wiki/${String(name)
        .replace(/\(.*\)/g, '')
        .trim()
        .replaceAll(' ', '_')}`;
}

function ItemLink({ name }) {
    return (
        <Link href={wikiHref(name)} target="_blank" rel="noreferrer">
            {name}
        </Link>
    );
}

function ChangedEntry({ entry }) {
    const t = useTranslation();
    const statLines = diffStats(entry.before, entry.after);
    const topLines = topLevelDiffs(entry.before, entry.after);
    const total = statLines.length + topLines.length;
    return (
        <div className={styles.changeEntry}>
            <div className={styles.changeEntryHead}>
                <HistoryIcon item={entry.item} compact />
                <span className={styles.changeEntryTitles}>
                    <span className={styles.groupName}>
                        <ItemLink name={entry.name} />
                    </span>
                    <span className={styles.groupMeta}>
                        {total} {total === 1 ? t('items.changes.stat') : t('items.changes.stats')}
                    </span>
                </span>
            </div>
            <div className={styles.changeEntryDiffs}>
                {statLines.map((line) => (
                    <DiffLine key={'stat-' + line.name} line={line} />
                ))}
                {topLines.map((line, i) =>
                    line.complex ? (
                        <div key={`top-${i}`} className={styles.complexLine}>
                            {line.key} {t('items.history.changed')}
                        </div>
                    ) : (
                        <div key={`top-${i}`} className={styles.complexLine}>
                            {line.key}: {line.old} → {line.fresh}
                        </div>
                    )
                )}
                {total === 0 && <div className={styles.complexLine}>{t('items.changes.noDiff')}</div>}
            </div>
        </div>
    );
}

function RunCard({ run, defaultOpen }) {
    const t = useTranslation();
    const [open, setOpen] = React.useState(defaultOpen);
    const counts = [
        run.added.length ? `${run.added.length} ${t('items.changes.added')}` : null,
        run.changed.length ? `${run.changed.length} ${t('items.changes.changed')}` : null,
        run.removed.length ? `${run.removed.length} ${t('items.changes.removed')}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className={styles.card}>
            <button
                type="button"
                className={`${styles.groupHeader} ${styles.runHeader}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className={styles.runDate}>{formatDateString(run.at)}</span>
                <span className={styles.runCounts}>{counts}</span>
                <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
                    ▸
                </span>
            </button>
            {open && (
                <div className={styles.timeline}>
                    {run.added.length > 0 && (
                        <section className={styles.runSection}>
                            <h3 className={styles.runSectionTitle}>
                                {t('items.changes.newItems')}{' '}
                                <span className={styles.runSectionCount}>({run.added.length})</span>
                            </h3>
                            <div className={styles.chipList}>
                                {run.added.map((entry) => (
                                    <span key={entry.key} className={styles.itemChip}>
                                        <ItemLink name={entry.name} />
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                    {run.changed.length > 0 && (
                        <section className={styles.runSection}>
                            <h3 className={styles.runSectionTitle}>
                                {t('items.changes.changedItems')}{' '}
                                <span className={styles.runSectionCount}>({run.changed.length})</span>
                            </h3>
                            <div className={styles.changeList}>
                                {run.changed.map((entry) => (
                                    <ChangedEntry key={entry.key} entry={entry} />
                                ))}
                            </div>
                        </section>
                    )}
                    {run.removed.length > 0 && (
                        <section className={styles.runSection}>
                            <h3 className={styles.runSectionTitle}>
                                {t('items.changes.removedItems')}{' '}
                                <span className={styles.runSectionCount}>({run.removed.length})</span>
                            </h3>
                            <div className={styles.chipList}>
                                {run.removed.map((entry) => (
                                    <span key={entry.key} className={`${styles.itemChip} ${styles.itemChipRemoved}`}>
                                        <ItemLink name={entry.name} />
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ApiChangesPage({ itemData, history }) {
    const t = useTranslation();
    const runs = React.useMemo(() => buildRunGroups(history, itemData || {}), [history, itemData]);
    const updatedAt = history && history.updatedAt ? history.updatedAt : null;

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>{t('items.changes.title')}</h1>
                <div className={styles.summaryLine}>
                    <Link href="/items" className={styles.backLink}>
                        ← {t('items.changes.backToItems')}
                    </Link>
                    <Link href="/items/history" className={styles.backLink}>
                        {t('items.changes.itemHistory')}
                    </Link>
                    {runs.length > 0 && (
                        <span className={styles.summaryText}>
                            {runs.length} {runs.length === 1 ? t('items.changes.update') : t('items.changes.updates')}
                            {updatedAt ? (
                                <span>
                                    {' '}
                                    · {t('items.history.lastUpdated')} {formatDateString(updatedAt)}
                                </span>
                            ) : null}
                        </span>
                    )}
                </div>
                {runs.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <b>{t('items.changes.empty')}</b>
                    </div>
                ) : (
                    <div className={styles.groupList}>
                        {runs.map((run, i) => (
                            <RunCard key={run.at} run={run} defaultOpen={i === 0} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
