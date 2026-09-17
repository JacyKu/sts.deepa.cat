'use client';

import React from 'react';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import TranslatableEnchant from '../translatableEnchant';

// One stat diff line (added / removed / changed), shared by the stat history
// timeline and the API changes page.
export default function DiffLine({ line }) {
    if (line.kind === 'added') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.kindDot} ${styles.addedDot}`} aria-hidden="true"></span>
                <TranslatableEnchant
                    title={line.name}
                    className={itemsStyles[line.fresh.style]}
                    style={line.fresh.color ? { color: line.fresh.color } : undefined}
                >
                    {line.fresh.text}
                </TranslatableEnchant>
            </div>
        );
    }
    if (line.kind === 'removed') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.kindDot} ${styles.removedDot}`} aria-hidden="true"></span>
                <s
                    className={`${itemsStyles[line.old.style]} ${styles.removedText}`}
                    style={line.old.color ? { color: line.old.color } : undefined}
                >
                    {line.old.text}
                </s>
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
                    <TranslatableEnchant
                        title={line.name}
                        style={line.old.color ? { color: line.old.color } : undefined}
                    >
                        {line.old.text}
                    </TranslatableEnchant>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                    →
                </span>
                <TranslatableEnchant
                    title={line.name}
                    className={itemsStyles[line.fresh.style]}
                    style={line.fresh.color ? { color: line.fresh.color } : undefined}
                >
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
