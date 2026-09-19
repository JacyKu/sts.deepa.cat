'use client';

import styles from '../../styles/CustomItems.module.css';
import { CustomItemCardSkeleton } from './customItemsSkeleton';
import { useTranslation } from '../useTranslation';

// Loading placeholder for /custom-items/[id]: same page/main wrapper and
// single .customItem card the share view renders (heart + copy actions, no
// edit pencil).
export default function CustomItemSkeleton() {
    const t = useTranslation();
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>{t('customItems.view.title')}</h1>
                <CustomItemCardSkeleton pencil={false} />
            </main>
        </div>
    );
}
