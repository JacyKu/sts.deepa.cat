import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';

// Loading placeholder for /items/history: same container/main wrapper and
// group-card list (max-width 900) the real history page renders.
export default function HistorySkeleton() {
    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>Item Stat History</h1>
                <div className={`${itemsStyles.skeleton} ${styles.skeletonSummary}`} />
                <div className={styles.groupList}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={styles.skeletonCard}>
                            <div className={`${itemsStyles.skeleton} ${styles.skeletonIcon}`} />
                            <div className={styles.skeletonLines}>
                                <div className={`${itemsStyles.skeleton} ${styles.skeletonLine}`} />
                                <div className={`${itemsStyles.skeleton} ${styles.skeletonLineShort}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
