'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../styles/Items.module.css';
import { getStsBase } from '../../utils/base';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';
import { useTranslation } from '../useTranslation';

// Item types come from the item data; map them to the same `items.type.*`
// keys the item tiles use, falling back to the raw value for unknown types.
function camelCase(str) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function typeLabel(t, type) {
    const key = `items.type.${camelCase(type)}`;
    const label = t(key);
    return label === key ? type : label;
}

// Collapsible "build list" panel pinned to the top-left of the items page.
// Shows the collected items and imports them into the builder. Only exists
// when the "Item import" menu toggle is on and the list has items.
export default function BuildListPanel() {
    const { items, addCount, removeItem, clear } = useBuildList();
    const { enabled } = useBuildListEnabled();
    const t = useTranslation();
    const [open, setOpen] = React.useState(true);
    const router = useRouter();

    // Expand when an item is added (restoring the list on mount does not bump addCount).
    React.useEffect(() => {
        if (addCount > 0) setOpen(true);
    }, [addCount]);

    if (!enabled || items.length === 0) return null;

    function importList() {
        router.push(getStsBase() + '/builder');
    }

    return (
        <div className={styles.listPanelWrap}>
            <div className={styles.listPanelHeader}>
                <span className={styles.listPanelTitle}>
                    {t('items.buildList.title')} ({items.length})
                </span>
                <button
                    type="button"
                    className={styles.listCollapseBtn}
                    onClick={() => setOpen((o) => !o)}
                    aria-label={open ? t('items.buildList.collapse') : t('items.buildList.expand')}
                    aria-expanded={open}
                >
                    {open ? '−' : '+'}
                </button>
            </div>
            {open && (
                <>
                    {items.map((entry) => (
                        <div className={styles.listRow} key={entry.name}>
                            <div className={styles.listRowInfo}>
                                <span className={styles.listRowName}>{entry.name}</span>
                                {entry.type ? (
                                    <span className={styles.listRowDesc}>{typeLabel(t, entry.type)}</span>
                                ) : (
                                    ''
                                )}
                            </div>
                            <button
                                type="button"
                                className={styles.listRowRemove}
                                onClick={() => removeItem(entry.name)}
                                aria-label={`${t('common.remove')} ${entry.name} ${t('items.buildList.fromBuildList')}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <div className={styles.listPanelActions}>
                        <button type="button" className={styles.importButton} onClick={importList}>
                            {t('items.buildList.importIntoBuilder')}
                        </button>
                        <button type="button" className={styles.listClearButton} onClick={clear}>
                            {t('common.clear')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
