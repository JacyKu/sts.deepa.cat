'use client';

import React from 'react';
import Link from 'next/link';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import HistoryIcon from './historyIcon';
import DiffLine from './itemDiffLine';
import { formatDateString } from '../../utils/dateFormat';
import { diffStats, topLevelDiffs } from '../../utils/items/itemDiff';
import { useTranslation } from '../useTranslation';

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
                        {line.key} {t('items.history.changed')}
                    </div>
                ) : (
                    <div key={`top-${i}`} className={styles.complexLine}>
                        {line.key}: {line.old} → {line.fresh}
                    </div>
                )
            )}
        </div>
    );
}

function collectGroups(itemData, history) {
    if (!history || !history.items) return [];
    return Object.entries(history.items)
        .filter(([, records]) => Array.isArray(records) && records.length > 0)
        .map(([key, records]) => {
            const current = itemData[key];
            const displayItem = current || records[records.length - 1].item;
            return {
                key,
                current: current || null,
                removed: !current,
                name: displayItem.name || key,
                records: [...records].sort((a, b) => String(a.at).localeCompare(String(b.at))),
                lastAt: records[0].at,
            };
        })
        .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
}

function ChangeGroup({ group }) {
    const t = useTranslation();
    const [open, setOpen] = React.useState(false);
    const displayItem = group.current || group.records[group.records.length - 1].item;
    const changeCount = group.records.length;

    function toggle(event) {
        if (event.target.closest('a')) return; // let the wiki link work on its own
        setOpen(!open);
    }

    function onKeyDown(event) {
        if (event.target.closest('a')) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(!open);
        }
    }

    return (
        <div className={styles.card}>
            <div
                className={styles.groupHeader}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={toggle}
                onKeyDown={onKeyDown}
            >
                <HistoryIcon item={displayItem} />
                <span className={styles.groupTitles}>
                    <span className={styles.groupName}>
                        <Link
                            href={`https://monumenta.wiki.gg/wiki/${String(group.name)
                                .replace(/\(.*\)/g, '')
                                .trim()
                                .replaceAll(' ', '_')}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {group.name}
                        </Link>
                    </span>
                    <span className={styles.groupMeta}>
                        {changeCount} {changeCount === 1 ? t('items.history.change') : t('items.history.changes')} ·{' '}
                        {t('items.history.last')} {formatDateString(group.lastAt)}
                        {group.removed && (
                            <span className={styles.removedChip}>{t('items.history.noLongerInGame')}</span>
                        )}
                    </span>
                </span>
                <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
                    ▸
                </span>
            </div>
            {open && (
                <div className={styles.timeline}>
                    {group.records.map((record, i) => {
                        const newerState = i < group.records.length - 1 ? group.records[i + 1].item : group.current;
                        return <VersionRow key={record.at + '-' + i} record={record} afterItem={newerState} />;
                    })}
                    <div className={styles.currentRow}>
                        {group.removed ? (
                            <span className={styles.versionDate}>{t('items.history.removedFromGame')}</span>
                        ) : (
                            <span className={styles.currentBadge}>{t('items.history.currentStats')}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HistoryPage({ itemData, history }) {
    const t = useTranslation();
    const groups = React.useMemo(() => collectGroups(itemData || {}, history), [itemData, history]);
    const totalRecords = groups.reduce((sum, g) => sum + g.records.length, 0);
    const updatedAt = history && history.updatedAt ? history.updatedAt : null;

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>{t('items.history.title')}</h1>
                <div className={styles.summaryLine}>
                    <Link href="/items" className={styles.backLink}>
                        ← {t('items.history.backToItems')}
                    </Link>
                    <Link href="/items/changes" className={styles.backLink}>
                        {t('items.changes.link')}
                    </Link>
                    {totalRecords > 0 && (
                        <span className={styles.summaryText}>
                            {groups.length}{' '}
                            {groups.length === 1 ? t('items.history.changedItem') : t('items.history.changedItems')} ·{' '}
                            {totalRecords}{' '}
                            {totalRecords === 1
                                ? t('items.history.archivedChange')
                                : t('items.history.archivedChanges')}
                            {updatedAt ? (
                                <span>
                                    {' '}
                                    · {t('items.history.lastUpdated')} {formatDateString(updatedAt)}
                                </span>
                            ) : null}
                        </span>
                    )}
                </div>
                {groups.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <b>{t('items.history.empty')}</b>
                    </div>
                ) : (
                    <div className={styles.groupList}>
                        {groups.map((group) => (
                            <ChangeGroup key={group.key} group={group} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
