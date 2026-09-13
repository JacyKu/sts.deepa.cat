import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/CustomItems.module.css';

// One placeholder custom-item card, mirroring the real .customItem markup
// (title + pencil row, type tag, icon + stat lines, footer, actions row).
// Shared by the page skeleton and the in-page "My items" loading state.
export function CustomItemCardSkeleton() {
    return (
        <div className={styles.customItem}>
            <div className={styles.cardTop}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardLine}`} />
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardIconBtn}`} />
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
            <div className={styles.cardActions}>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtn}`} />
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtnShort}`} />
                <div className={`${itemsStyles.skeleton} ${styles.skeletonBlock} ${styles.skeletonCardBtnShort}`} />
            </div>
        </div>
    );
}

// Loading placeholder for /custom-items: title, editor form slab and the
// "My items" card grid, all at the real max-widths (main and grid 1160,
// form 720).
export default function CustomItemsSkeleton() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>Custom Items</h1>
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
