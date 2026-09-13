'use client';

// Two tab switchers for the site's paired pages: Builds / Custom items on the
// public database pages, and My Builds / My Favourites / My Items on the
// account pages. Both share the same tab styling.
import React from 'react';
import Link from 'next/link';
import styles from '../styles/DatabaseTabs.module.css';
import { getStsBase } from '../utils/base';

function Tabs({ active, tabs, className = '', label }) {
    return (
        <div className={`${styles.dbTabs}${className ? ' ' + className : ''}`} role="tablist" aria-label={label}>
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

export default function DatabaseTabs({ active, tabs, className }) {
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);
    return (
        <Tabs
            active={active}
            className={className}
            label="Database sections"
            tabs={
                tabs || [
                    { key: 'builds', label: 'Builds', href: `${base}/database` },
                    { key: 'custom-items', label: 'Custom items', href: `${base}/database/custom-items` },
                ]
            }
        />
    );
}

export function MyPagesTabs({ active, className }) {
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);
    return (
        <Tabs
            active={active}
            className={className}
            label="My pages"
            tabs={[
                { key: 'builds', label: 'My Builds', href: `${base}/builds` },
                { key: 'favourites', label: 'My Favourites', href: `${base}/builds/favourites` },
                { key: 'custom-items', label: 'My Items', href: `${base}/custom-items` },
            ]}
        />
    );
}
