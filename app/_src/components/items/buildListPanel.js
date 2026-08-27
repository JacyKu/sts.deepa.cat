'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../styles/Items.module.css';
import { getStsBase } from '../../utils/base';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';

// Collapsible "build list" panel pinned to the top-left of the items page.
// Shows the collected items and imports them into the builder. Only exists
// when the "Item import" menu toggle is on and the list has items.
export default function BuildListPanel() {
    const { items, addCount, removeItem, clear } = useBuildList();
    const { enabled } = useBuildListEnabled();
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
                <span className={styles.listPanelTitle}>Build list ({items.length})</span>
                <button
                    type="button"
                    className={styles.listCollapseBtn}
                    onClick={() => setOpen((o) => !o)}
                    aria-label={open ? 'Collapse build list' : 'Expand build list'}
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
                                {entry.type ? <span className={styles.listRowDesc}>{entry.type}</span> : ''}
                            </div>
                            <button
                                type="button"
                                className={styles.listRowRemove}
                                onClick={() => removeItem(entry.name)}
                                aria-label={`Remove ${entry.name} from build list`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <div className={styles.listPanelActions}>
                        <button type="button" className={styles.importButton} onClick={importList}>
                            Import into builder
                        </button>
                        <button type="button" className={styles.listClearButton} onClick={clear}>
                            Clear
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
