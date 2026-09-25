'use client';

import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import { useTranslation } from '../useTranslation';

// Loading placeholder for /classes/changes: title, summary line and run cards
// matching the real page's geometry.
export default function ClassChangesSkeleton() {
    const t = useTranslation();
    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>{t('classes.changes.title')}</h1>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonSummary}`} />
                <div className={styles.groupList}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={styles.skeletonRunCard}>
                            <div className={`${itemsStyles.skeleton} ${styles.skeletonLine}`} />
                            <div className={`${itemsStyles.skeleton} ${styles.skeletonLineShort}`} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
