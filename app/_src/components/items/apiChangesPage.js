'use client';

import React from 'react';
import Link from 'next/link';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import HistoryIcon from './historyIcon';
import DiffLine from './itemDiffLine';
import { useMaxMasterwork } from './maxMasterworkContext';
import { formatDateString, formatMonthString } from '../../utils/dateFormat';
import { buildRunGroups } from '../../utils/items/apiChanges';
import { allStatLines, topLevelDiffs, humanizeField } from '../../utils/items/itemDiff';
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

// Runs are grouped by month; each run shows its full timestamp (UTC) so
// several runs on one day stay distinct.
function monthKey(at) {
    return String(at || '').slice(0, 7);
}

// Runs arrive newest-first; collect them under their month (also
// newest-first) so the page reads as a dated changelog.
function groupByMonth(runs) {
    const groups = [];
    for (const run of runs) {
        const key = monthKey(run.at);
        const last = groups[groups.length - 1];
        if (last && last.month === key) last.runs.push(run);
        else groups.push({ month: key, runs: [run] });
    }
    return groups;
}

function ChangedEntry({ entry }) {
    const t = useTranslation();
    // Masterwork variants of one item share an entry; the star switcher (the
    // same as the item tiles) picks which variant's diff is shown. The
    // default follows the header's "max masterwork" setting, like the item
    // tiles do.
    const { enabled: maxMasterworkDefault } = useMaxMasterwork();
    const defaultIndex = React.useMemo(() => {
        if (entry.variants.length === 0) return 0;
        if (!maxMasterworkDefault) return 0;
        let best = 0;
        for (let i = 1; i < entry.variants.length; i++) {
            if (entry.variants[i].masterwork > entry.variants[best].masterwork) best = i;
        }
        return best;
    }, [entry.variants, maxMasterworkDefault]);
    const [activeIndex, setActiveIndex] = React.useState(defaultIndex);
    React.useEffect(() => {
        setActiveIndex(defaultIndex);
    }, [defaultIndex]);
    const variant = entry.variants[Math.min(activeIndex, entry.variants.length - 1)];
    // The full stat block of the variant, in the item display order; changed
    // stats are marked, unchanged ones are shown so the item is readable.
    const statLines = allStatLines(variant.before, variant.after);
    const topLines = topLevelDiffs(variant.before, variant.after);
    const statCount = statLines.filter((line) => line.kind !== 'same').length;
    const meta = [
        variant.masterwork > 0 ? `${t('items.changes.masterwork')} ${variant.masterwork}` : null,
        statCount > 0
            ? `${statCount} ${statCount === 1 ? t('items.changes.stat') : t('items.changes.stats')}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
    return (
        <div className={styles.changeEntry}>
            <div className={styles.changeEntryHead}>
                <HistoryIcon item={variant.item} compact />
                <span className={styles.changeEntryTitles}>
                    <span className={styles.groupName}>
                        <ItemLink name={entry.name} />
                    </span>
                    <span className={styles.groupMeta}>{meta}</span>
                </span>
                {entry.variants.length > 1 && (
                    <span
                        className={styles.masterworkSwitcher}
                        role="group"
                        aria-label={t('items.changes.masterwork')}
                    >
                        {entry.variants.map((v, i) => (
                            <button
                                key={v.key}
                                type="button"
                                className={`${styles.masterworkStar}${
                                    v.masterwork <= variant.masterwork ? ` ${styles.masterworkStarOn}` : ''
                                }`}
                                aria-pressed={i === activeIndex}
                                aria-label={`${t('items.changes.masterwork')} ${v.masterwork}`}
                                title={`${t('items.changes.masterwork')} ${v.masterwork}`}
                                onClick={() => setActiveIndex(i)}
                            >
                                ★
                            </button>
                        ))}
                    </span>
                )}
            </div>
            <div className={styles.changeEntryDiffs}>
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
                {statCount === 0 && topLines.length === 0 && (
                    <div className={styles.complexLine}>{t('items.changes.noDiff')}</div>
                )}
            </div>
        </div>
    );
}

function RunCard({ run, defaultOpen, showLoreOnly }) {
    const t = useTranslation();
    const [open, setOpen] = React.useState(defaultOpen);
    const counts = [
        run.added.length ? `${run.added.length} ${t('items.changes.added')}` : null,
        run.changed.length ? `${run.changed.length} ${t('items.changes.changed')}` : null,
        run.removed.length ? `${run.removed.length} ${t('items.changes.removed')}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
    // Lore-only entries are hidden unless the page toggle is on; the section
    // count shows how many were recorded so nothing is lost silently.
    const visibleChanged = showLoreOnly ? run.changed : run.changed.filter((entry) => !entry.loreOnly);
    const hiddenChanged = run.changed.length - visibleChanged.length;

    return (
        <div className={styles.card}>
            <button
                type="button"
                className={`${styles.groupHeader} ${styles.runHeader}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className={styles.runTime}>
                    {formatDateString(run.at, { includeTime: true, utc: true })}{' '}
                    <span className={styles.runTimeZone}>UTC</span>
                </span>
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
                                <span className={styles.runSectionCount}>
                                    (
                                    {hiddenChanged > 0
                                        ? `${visibleChanged.length}/${run.changed.length}`
                                        : run.changed.length}
                                    )
                                </span>
                            </h3>
                            {visibleChanged.length > 0 && (
                                <div className={styles.changeList}>
                                    {visibleChanged.map((entry) => (
                                        <ChangedEntry key={entry.name} entry={entry} />
                                    ))}
                                </div>
                            )}
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
    const monthGroups = React.useMemo(() => groupByMonth(runs), [runs]);
    const updatedAt = history && history.updatedAt ? history.updatedAt : null;
    const [showLoreOnly, setShowLoreOnly] = React.useState(false);
    const loreOnlyCount = React.useMemo(
        () => runs.reduce((sum, run) => sum + run.changed.filter((entry) => entry.loreOnly).length, 0),
        [runs]
    );

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>
                    {t('items.changes.title')}{' '}
                    <span className={styles.experimentalBadge}>{t('items.changes.experimental')}</span>
                </h1>
                <div className={styles.summaryLine}>
                    <Link href="/items" className={styles.backLink}>
                        ← {t('items.changes.backToItems')}
                    </Link>
                    {runs.length > 0 && (
                        <span className={styles.summaryText}>
                            {runs.length} {runs.length === 1 ? t('items.changes.update') : t('items.changes.updates')}
                            {updatedAt ? (
                                <span>
                                    {' '}
                                    · {t('items.history.lastUpdated')}{' '}
                                    {formatDateString(updatedAt, { includeTime: true, utc: true })} UTC
                                </span>
                            ) : null}
                        </span>
                    )}
                </div>
                {loreOnlyCount > 0 && (
                    <div className={styles.toggleRow}>
                        <label className={styles.loreToggle}>
                            <input
                                type="checkbox"
                                checked={showLoreOnly}
                                onChange={(e) => setShowLoreOnly(e.target.checked)}
                                aria-label={t('items.changes.showLoreOnly')}
                            />
                            {t('items.changes.showLoreOnly')} ({loreOnlyCount})
                        </label>
                    </div>
                )}
                {runs.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <b>{t('items.changes.empty')}</b>
                    </div>
                ) : (
                    <div className={styles.groupList}>
                        {monthGroups.map((group) => (
                            <section key={group.month} className={styles.dateGroup}>
                                <h2 className={styles.dateHeading}>{formatMonthString(group.month)}</h2>
                                {group.runs.map((run) => (
                                    <RunCard
                                        key={run.at}
                                        run={run}
                                        defaultOpen={run === runs[0]}
                                        showLoreOnly={showLoreOnly}
                                    />
                                ))}
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
