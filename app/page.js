'use client';

import React from 'react';
import styles from './_src/styles/Home.module.css';
import Link from 'next/link';
import { getStsBase } from './_src/utils/base';
import TranslatableText from './_src/components/translatableText';
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

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}>Spare the Sympathy</h1>
                {itemCount !== null && (
                    <p className={styles.stats}>
                        {itemCount.toLocaleString()} {t('index.itemsCatalogued')}
                    </p>
                )}
                <div className={styles.grid}>
                    <Link href={base + '/items'} className={styles.card}>
                        <h2>
                            <TranslatableText identifier="index.pages.items.title"></TranslatableText>
                        </h2>
                        <p>
                            <TranslatableText identifier="index.pages.items.description"></TranslatableText>
                        </p>
                    </Link>
                </div>

                <div className={styles.grid}>
                    <Link href={base + '/builder'} className={styles.card}>
                        <h2>
                            <TranslatableText identifier="index.pages.builder.title"></TranslatableText>
                        </h2>
                        <p>
                            <TranslatableText identifier="index.pages.builder.description"></TranslatableText>
                        </p>
                    </Link>
                </div>
            </main>
        </div>
    );
}
