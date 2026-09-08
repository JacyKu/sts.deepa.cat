'use client';

import React from 'react';
import Link from 'next/link';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import TranslatableEnchant from '../translatableEnchant';
import { formatDateString } from '../../utils/dateFormat';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../../utils/items/minecraftFallback';
import { statSnapshot } from '../../utils/items/statFormatter';

const TOP_LEVEL_TEXT_KEYS = ['type', 'tier', 'region', 'location', 'base_item', 'original_item'];
const COMPLEX_KEYS = ['lore', 'mmlore', 'effects'];

function camelCase(str, upper) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 && !upper ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function sheetClassFromName(itemName) {
    return `monumenta-${camelCase(
        itemName
            .replace(/^EX\s+/, '')
            .replaceAll('-', '')
            .replaceAll('.', '')
            .replaceAll("'", '')
            .replace(/\(.*\)/g, '')
            .trim()
            .replaceAll(' ', '-')
            .replaceAll('_', '-')
            .toLowerCase(),
        true
    )}`;
}

function HistoryIcon({ item }) {
    // Same resolution order as the item tiles: texture token, sprite map,
    // legacy name heuristic (while the map loads), then the minecraft texture.
    const [cssClass, setCssClass] = React.useState(item.textureToken ? `monumenta-${item.textureToken}` : null);
    const [baseClass, setBaseClass] = React.useState('monumenta-items');
    const [spriteMap, setSpriteMap] = React.useState(null);

    React.useEffect(() => {
        let active = true;
        loadItemSpriteMap().then((map) => {
            if (active) setSpriteMap(map);
        });
        return () => {
            active = false;
        };
    }, []);

    React.useEffect(() => {
        if (item.textureToken) {
            setBaseClass('monumenta-items');
            setCssClass(`monumenta-${item.textureToken}`);
            return;
        }
        if (spriteMap) {
            const mapped = getMappedSpriteClass(spriteMap, item.name);
            if (mapped) {
                setBaseClass('monumenta-items');
                setCssClass(mapped);
                return;
            }
            if (item.base_item) {
                setBaseClass('minecraft');
                setCssClass(`minecraft-${getMinecraftTextureKey(item.base_item)}`);
                return;
            }
        }
        setBaseClass('monumenta-items');
        setCssClass(sheetClassFromName(item.name));
    }, [item, spriteMap]);

    return (
        <div className={`${itemsStyles.imageIcon} ${styles.groupIcon}`}>
            <div className={[baseClass, cssClass].join(' ')}></div>
        </div>
    );
}

function numericValue(value) {
    if (typeof value === 'number') return value;
    if (value !== null && typeof value === 'object' && 'value' in value && typeof value.value === 'number') {
        return value.value;
    }
    return NaN;
}

// Item objects from two dumps may carry object-typed values (e.g.
// { value: 5 }); compare by stable shape rather than raw identity.
function valueKey(value) {
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function diffStats(beforeItem, afterItem) {
    const beforeSnap = statSnapshot(beforeItem && beforeItem.stats);
    const afterSnap = statSnapshot(afterItem && afterItem.stats);
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

function topLevelDiffs(beforeItem, afterItem) {
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

function DiffLine({ line }) {
    if (line.kind === 'added') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.kindDot} ${styles.addedDot}`} aria-hidden="true"></span>
                <TranslatableEnchant title={line.name} className={itemsStyles[line.fresh.style]}>
                    {line.fresh.text}
                </TranslatableEnchant>
            </div>
        );
    }
    if (line.kind === 'removed') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.kindDot} ${styles.removedDot}`} aria-hidden="true"></span>
                <s className={`${itemsStyles[line.old.style]} ${styles.removedText}`}>{line.old.text}</s>
            </div>
        );
    }
    if (line.kind === 'changed') {
        const pct = /percent/i.test(line.name);
        return (
            <div className={styles.diffLine}>
                <span
                    className={`${styles.kindDot} ${
                        line.delta > 0 ? styles.buffDot : line.delta < 0 ? styles.nerfDot : styles.changedDot
                    }`}
                    aria-hidden="true"
                ></span>
                <span className={styles.oldText}>
                    <TranslatableEnchant title={line.name}>{line.old.text}</TranslatableEnchant>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                    →
                </span>
                <TranslatableEnchant title={line.name} className={itemsStyles[line.fresh.style]}>
                    {line.fresh.text}
                </TranslatableEnchant>
                {Number.isFinite(line.delta) && line.delta !== 0 && (
                    <span className={`${styles.delta} ${line.delta > 0 ? styles.deltaUp : styles.deltaDown}`}>
                        {line.delta > 0 ? '+' : ''}
                        {line.delta}
                        {pct ? '%' : ''}
                    </span>
                )}
            </div>
        );
    }
    return null;
}

function VersionRow({ record, afterItem }) {
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
                        {line.key} changed
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
                        {changeCount} {changeCount === 1 ? 'change' : 'changes'} · last{' '}
                        {formatDateString(group.lastAt)}
                        {group.removed && <span className={styles.removedChip}>no longer in game</span>}
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
                            <span className={styles.versionDate}>Removed from the game</span>
                        ) : (
                            <span className={styles.currentBadge}>current stats</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HistoryPage({ itemData, history }) {
    const groups = React.useMemo(() => collectGroups(itemData || {}, history), [itemData, history]);
    const totalRecords = groups.reduce((sum, g) => sum + g.records.length, 0);
    const updatedAt = history && history.updatedAt ? history.updatedAt : null;

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>Item Stat History</h1>
                <div className={styles.summaryLine}>
                    <Link href="/items" className={styles.backLink}>
                        ← Back to items
                    </Link>
                    {totalRecords > 0 && (
                        <span className={styles.summaryText}>
                            {groups.length} changed item{groups.length === 1 ? '' : 's'} · {totalRecords} archived
                            change{totalRecords === 1 ? '' : 's'}
                            {updatedAt ? (
                                <span>
                                    {' '}
                                    · last updated {formatDateString(updatedAt)}
                                </span>
                            ) : null}
                        </span>
                    )}
                </div>
                {groups.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <b>No stat history yet.</b>
                        <br />
                        Archived item versions appear here after the next item dump import picks up a stat change.
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
