'use client';

import React from 'react';
import styles from './_src/styles/Home.module.css';
import Link from 'next/link';
import { getStsBase } from './_src/utils/base';
import TranslatableText from './_src/components/translatableText';
import SpookyArt from './_src/components/spookyArt';
import { useTranslation } from './_src/components/useTranslation';

export default function Home() {
    const t = useTranslation();
    const base = getStsBase();
    const [itemCount, setItemCount] = React.useState(null);

    React.useEffect(() => {
        fetch('/api/v2/spritesheetCoverage')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d && d.totals) setItemCount(d.totals.items);
            })
            .catch(() => {});
    }, []);

    // The four linked pages, shown as a 2x2 box under the art and title (a
    // single column on phones). The order here is the order they appear.
    const pages = [
        { key: 'items', href: '/items' },
        { key: 'builder', href: '/builder' },
        { key: 'database', href: '/database' },
        { key: 'compare', href: '/compare' },
    ];

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.frame}>
                    <div className={styles.center}>
                        <SpookyArt name="spooky_assets_0006" width={192} style={{ marginBottom: '0.25rem' }} />
                        <h1 className={styles.title}>Spare the Sympathy</h1>
                        {itemCount !== null && (
                            <p className={styles.stats}>
                                {itemCount.toLocaleString()} {t('index.itemsCatalogued')}
                            </p>
                        )}
                    </div>
                    <div className={styles.cards}>
                        {pages.map((page) => (
                            <Link key={page.key} href={base + page.href} className={styles.card}>
                                <h2>
                                    <TranslatableText identifier={`index.pages.${page.key}.title`}></TranslatableText>
                                </h2>
                                <p>
                                    <TranslatableText
                                        identifier={`index.pages.${page.key}.description`}
                                    ></TranslatableText>
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
