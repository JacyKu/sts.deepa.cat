'use client';

import React from 'react';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import TranslatableEnchant from '../translatableEnchant';
import { numericValue } from '../../utils/items/itemDiff';

// One stat line, shared by the item tiles' history panels and the API changes
// page. The label is shown once ("Attack Damage 14 -> 10 (-4)"), which keeps
// changed and unchanged lines compact and easy to scan.
export default function DiffLine({ line }) {
    if (line.kind === 'same') {
        return (
            <div className={styles.diffLine}>
                <TranslatableEnchant
                    title={line.name}
                    className={itemsStyles[line.fresh.style]}
                    contentClassName={styles.sameLineText}
                    style={line.fresh.color ? { color: line.fresh.color } : undefined}
                >
                    {`${line.fresh.label} ${line.fresh.valueText}`.trim()}
                </TranslatableEnchant>
            </div>
        );
    }
    if (line.kind === 'added') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.changeMark} ${styles.deltaUp}`} aria-hidden="true">
                    +
                </span>
                <TranslatableEnchant
                    title={line.name}
                    className={itemsStyles[line.fresh.style]}
                    style={line.fresh.color ? { color: line.fresh.color } : undefined}
                >
                    {`${line.fresh.label} ${line.fresh.valueText}`.trim()}
                </TranslatableEnchant>
            </div>
        );
    }
    if (line.kind === 'removed') {
        return (
            <div className={styles.diffLine}>
                <span className={`${styles.changeMark} ${styles.deltaDown}`} aria-hidden="true">
                    −
                </span>
                <s
                    className={`${itemsStyles[line.old.style]} ${styles.removedText}`}
                    style={line.old.color ? { color: line.old.color } : undefined}
                >
                    {`${line.old.label} ${line.old.valueText}`.trim()}
                </s>
            </div>
        );
    }
    if (line.kind === 'changed') {
        const oldNum = numericValue(line.old.rawValue);
        const newNum = numericValue(line.fresh.rawValue);
        const hasNums = Number.isFinite(oldNum) && Number.isFinite(newNum);
        const delta = hasNums ? Math.round((newNum - oldNum) * 100) / 100 : NaN;
        const hasDelta = hasNums && delta !== 0;
        const isPercentStat = /%/.test(line.fresh.valueText) || /%/.test(line.old.valueText);

        return (
            <div className={styles.diffLine}>
                <span
                    className={itemsStyles[line.old.style]}
                    style={line.old.color ? { color: line.old.color } : undefined}
                >
                    <TranslatableEnchant title={line.name} contentClassName={styles.oldValue}>
                        {line.old.label}
                    </TranslatableEnchant>{' '}
                    <span className={styles.oldValue}>{line.old.valueText}</span>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                    →
                </span>
                <TranslatableEnchant
                    title={line.name}
                    className={itemsStyles[line.fresh.style]}
                    style={line.fresh.color ? { color: line.fresh.color } : undefined}
                >
                    {line.fresh.valueText}
                </TranslatableEnchant>
                {hasDelta && (
                    <span className={styles.delta}>
                        <span className={styles.deltaBracket}>(</span>
                        <span className={delta > 0 ? styles.deltaUp : styles.deltaDown}>
                            {`${delta > 0 ? '+' : ''}${delta}${isPercentStat ? '%' : ''}`}
                        </span>
                        <span className={styles.deltaBracket}>)</span>
                    </span>
                )}
            </div>
        );
    }
    return null;
}
