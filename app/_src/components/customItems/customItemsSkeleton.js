'use client';

import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/CustomItems.module.css';
import { useTranslation } from '../useTranslation';

// One placeholder custom-item card, mirroring the real .customItem markup.
// The real card's slots vary by page: My Items shows heart + pencil + the
// actions row, the share view shows heart + actions, the favourites list
// shows only the heart. Each placeholder keeps the real slot sizes so the
// loaded layout lands in the same place.
export function CustomItemCardSkeleton({ heart = true, pencil = true, actions = true }) {
    return (
        <div className={styles.customItem}>
            <div className={styles.cardTop}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardLine}`} />
                {(heart || pencil) && (
                    <span className={styles.cardTopBtns}>
                        {heart && (
                            <div
                                className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardHeart}`}
                            />
                        )}
                        {pencil && (
                            <div
                                className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardIconBtn}`}
                            />
                        )}
                    </span>
                )}
            </div>
            <div className={styles.cardTags}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardTag}`} />
            </div>
            <div className={styles.cardBody}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardIcon}`} />
                <div className={styles.skeletonCardLines}>
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardLine}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardLine}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardShort}`} />
                </div>
            </div>
            <div className={styles.cardBottom}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardShort}`} />
            </div>
            {actions && (
                <div className={styles.cardActions}>
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtn}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtnShort}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtnShort}`} />
                </div>
            )}
        </div>
    );
}

// Loading placeholder for /custom-items: title, My Pages switcher, editor
// form slab and the "My items" card grid, all at the real max-widths (main
// and grid 1160, form 720).
export default function CustomItemsSkeleton() {
    const t = useTranslation();
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>{t('customItems.title')}</h1>
                <div className={styles.skeletonTabs}>
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonTab}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonTabWide}`} />
                    <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonTab}`} />
                </div>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonForm}`} />
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonHeading}`} />
                <div className={styles.itemGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <CustomItemCardSkeleton key={i} />
                    ))}
                </div>
            </main>
        </div>
    );
}
