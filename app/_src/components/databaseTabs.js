'use client';

// Builds / Custom items switcher shown at the top of the database pages.
import React from 'react';
import Link from 'next/link';
import styles from '../styles/DatabaseTabs.module.css';
import { getStsBase } from '../utils/base';

export default function DatabaseTabs({ active }) {
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);
    const tabs = [
        { key: 'builds', label: 'Builds', href: `${base}/database` },
        { key: 'custom-items', label: 'Custom items', href: `${base}/database/custom-items` },
    ];
    return (
        <div className={styles.dbTabs} role="tablist" aria-label="Database sections">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={tab.href}
                    role="tab"
                    aria-selected={active === tab.key}
                    className={`${styles.dbTab}${active === tab.key ? ' ' + styles.dbTabActive : ''}`}
                >
                    {tab.label}
                </Link>
            ))}
        </div>
    );
}
