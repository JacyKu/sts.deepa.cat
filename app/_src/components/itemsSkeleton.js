import styles from '../styles/Items.module.css';

// Loading placeholder for the items page (/items): container + main wrapper,
// search form, result count/link lines and the tile grid, all matching the
// real element widths (tiles are 260px like ItemTile).
export default function ItemsSkeleton() {
    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1>Monumenta Items</h1>
                <div className={styles.skeletonSearchForm}>
                    <div className={`${styles.skeleton} ${styles.skeletonToolbarButton}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonField}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonField}`} />
                    <div className={styles.skeletonActions}>
                        <div className={styles.skeleton} />
                        <div className={styles.skeleton} />
                    </div>
                    <div className={styles.skeletonToggleRow}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`${styles.skeleton} ${styles.skeletonToggle}`} />
                        ))}
                    </div>
                </div>
                <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
                <div className={`${styles.skeleton} ${styles.skeletonLink}`} />
                <div className={styles.skeletonGrid}>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className={`${styles.skeleton} ${styles.skeletonTile}`}>
                            <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
                            <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                            <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                            <div className={`${styles.skeleton} ${styles.skeletonTextShort}`} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
