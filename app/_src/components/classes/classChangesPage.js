'use client';

import React from 'react';
import Link from 'next/link';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import { formatDateString, formatMonthString } from '../../utils/dateFormat';
import { buildClassRunGroups, classDiffLines } from '../../utils/classes/classDiff';
import { useTranslation } from '../useTranslation';

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

// One changed single-line value, styled like the API changes page's stat
// lines: a "+" / "−" marker on added and removed values, and "label old → new"
// for changed ones. Long text uses the bordered text-diff panel below instead.
function LineChange({ kind, text }) {
    return (
        <div className={styles.diffLine}>
            <span
                className={`${styles.changeMark} ${kind === 'added' ? styles.deltaUp : styles.deltaDown}`}
                aria-hidden="true"
            >
                {kind === 'added' ? '+' : '−'}
            </span>
            {kind === 'added' ? (
                <span className={styles.lineText}>{text || '\u00a0'}</span>
            ) : (
                <s className={`${styles.lineText} ${styles.removedText}`}>{text || '\u00a0'}</s>
            )}
        </div>
    );
}

function DiffRow({ line }) {
    // Long text (descriptions): a git-style unified text diff in a bordered
    // panel. The whole text stays visible - unchanged lines dimmed, removed
    // lines red-tinted, added lines green-tinted (see textLineDiff).
    if (line.multiline) {
        return (
            <div className={styles.fieldDiff}>
                <span className={styles.fieldName}>{line.label}</span>
                <div className={styles.textDiff}>
                    {(line.rows || []).map((row, index) => (
                        <div
                            key={`${line.key}-${index}`}
                            className={`${styles.textDiffRow} ${
                                row.kind === 'added'
                                    ? styles.textDiffAdd
                                    : row.kind === 'removed'
                                      ? styles.textDiffDel
                                      : styles.textDiffSame
                            }`}
                        >
                            <span className={styles.textDiffSign} aria-hidden="true">
                                {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ''}
                            </span>
                            <span className={styles.textDiffText}>{row.text || '\u00a0'}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (line.kind === 'added') {
        return <LineChange kind="added" text={`${line.label}: ${line.fresh}`} />;
    }
    if (line.kind === 'removed') {
        return <LineChange kind="removed" text={`${line.label}: ${line.old}`} />;
    }
    return (
        <div className={styles.diffLine}>
            <span className={styles.fieldName}>{line.label}:</span>
            <span className={styles.oldValue}>{line.old}</span>
            <span className={styles.arrow} aria-hidden="true">
                →
            </span>
            <span>{line.fresh}</span>
        </div>
    );
}

function entryMeta(entry, entity, t) {
    if (entity === 'class') return t('classes.changes.kind.classPassive');
    if (entity === 'spec') return `${entry.class || ''} · ${t('classes.changes.kind.spec')}`;
    return entry.spec ? `${entry.class || ''} · ${entry.spec}` : entry.class || '';
}

function ChangedEntry({ entry, entity }) {
    const t = useTranslation();
    const lines = classDiffLines(entity, entry.before, entry.after);
    return (
        <div className={styles.changeEntry}>
            <div className={styles.changeEntryHead}>
                <span className={styles.changeEntryTitles}>
                    <span className={styles.groupName}>{entry.name}</span>
                    <span className={styles.groupMeta}>{entryMeta(entry, entity, t)}</span>
                </span>
            </div>
            <div className={`${styles.changeEntryDiffs} ${styles.classDiff}`}>
                {lines.map((line) => (
                    <DiffRow key={line.key} line={line} />
                ))}
                {lines.length === 0 && <div className={styles.complexLine}>{t('classes.changes.noDiff')}</div>}
            </div>
        </div>
    );
}

function EntryChip({ entry, entity, removed }) {
    const t = useTranslation();
    const meta = entryMeta(entry, entity, t);
    return (
        <span className={`${styles.itemChip} ${removed ? styles.itemChipRemoved : ''}`}>
            <span className={styles.chipName}>{entry.name}</span>
            {meta ? <span className={styles.chipMeta}>{meta}</span> : null}
        </span>
    );
}

// Skills and specializations read as one list: both are abilities the builder
// offers, and a spec ability carries its spec in the meta. Every entry gets an
// `entity` tag so the diff knows which field set to compare.
function mergeAbilities(skills, specs) {
    const tagged = (entries, entity) => entries.map((entry) => ({ ...entry, entity }));
    return {
        added: [...tagged(skills.added, 'skill'), ...tagged(specs.added, 'spec')],
        removed: [...tagged(skills.removed, 'skill'), ...tagged(specs.removed, 'spec')],
        changed: [...tagged(skills.changed, 'skill'), ...tagged(specs.changed, 'spec')],
    };
}

function RunCard({ run, defaultOpen }) {
    const t = useTranslation();
    const [open, setOpen] = React.useState(defaultOpen);
    const skills = mergeAbilities(run.skills, run.specs);
    const counts = [
        run.addedCount ? `${run.addedCount} ${t('items.changes.added')}` : null,
        run.changedCount ? `${run.changedCount} ${t('items.changes.changed')}` : null,
        run.removedCount ? `${run.removedCount} ${t('items.changes.removed')}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const sections = [
        { key: 'newClasses', title: t('classes.changes.newClasses'), entries: run.classes.added, entity: 'class' },
        {
            key: 'changedClasses',
            title: t('classes.changes.changedClasses'),
            entries: run.classes.changed,
            entity: 'class',
            changed: true,
        },
        {
            key: 'removedClasses',
            title: t('classes.changes.removedClasses'),
            entries: run.classes.removed,
            entity: 'class',
            removed: true,
        },
        { key: 'newSkills', title: t('classes.changes.newSkills'), entries: skills.added, entity: null },
        {
            key: 'changedSkills',
            title: t('classes.changes.changedSkills'),
            entries: skills.changed,
            changed: true,
        },
        {
            key: 'removedSkills',
            title: t('classes.changes.removedSkills'),
            entries: skills.removed,
            removed: true,
        },
    ].filter((section) => section.entries.length > 0);

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
                    {sections.map((section) => (
                        <section key={section.key} className={styles.runSection}>
                            <h3 className={styles.runSectionTitle}>
                                {section.title}{' '}
                                <span className={styles.runSectionCount}>({section.entries.length})</span>
                            </h3>
                            {section.changed ? (
                                <div className={styles.changeList}>
                                    {section.entries.map((entry) => (
                                        <ChangedEntry
                                            key={entry.key || entry.name}
                                            entry={entry}
                                            entity={entry.entity || section.entity}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.chipList}>
                                    {section.entries.map((entry) => (
                                        <EntryChip
                                            key={entry.key || entry.name}
                                            entry={entry}
                                            entity={entry.entity || section.entity || 'skill'}
                                            removed={Boolean(section.removed)}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ClassChangesPage({ classData, history }) {
    const t = useTranslation();
    const runs = React.useMemo(() => buildClassRunGroups(history, classData || {}), [history, classData]);
    const monthGroups = React.useMemo(() => groupByMonth(runs), [runs]);
    const updatedAt = history && history.updatedAt ? history.updatedAt : null;

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>
                    {t('classes.changes.title')}{' '}
                    <span className={styles.experimentalBadge}>{t('items.changes.experimental')}</span>
                </h1>
                <div className={styles.summaryLine}>
                    <Link href="/items" className={styles.backLink}>
                        ← {t('items.changes.backToItems')}
                    </Link>
                    {runs.length > 0 && (
                        <span className={styles.summaryText}>
                            {runs.length}{' '}
                            {runs.length === 1 ? t('classes.changes.update') : t('classes.changes.updates')}
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
                {runs.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <b>{t('classes.changes.empty')}</b>
                    </div>
                ) : (
                    <div className={styles.groupList}>
                        {monthGroups.map((group) => (
                            <section key={group.month} className={styles.dateGroup}>
                                <h2 className={styles.dateHeading}>{formatMonthString(group.month)}</h2>
                                {group.runs.map((run) => (
                                    <RunCard key={run.at} run={run} defaultOpen={run === runs[0]} />
                                ))}
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
