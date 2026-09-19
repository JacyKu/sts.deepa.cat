import styles from '../styles/Items.module.css';

// Loading placeholder for /builder: same container-fluid + builderPage
// wrapper and full-width form rows the real builder uses (six slot columns,
// then stat cards).
export default function BuilderSkeleton() {
    return (
        <div className="container-fluid">
            <main className={styles.builderPage}>
                <h1>Monumenta Builder</h1>
                <div className={styles.skeletonImportBar}>
                    <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
                </div>
                <div className={styles.skeletonForm}>
                    <div className={styles.skeletonRow}>
                        {['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'].map((slot) => (
                            <div key={slot} className={styles.skeletonSelectCol}>
                                <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                                <div className={`${styles.skeleton} ${styles.skeletonSelect}`} />
                            </div>
                        ))}
                    </div>
                    <div className={styles.skeletonRow}>
                        <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
                        <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
                        <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
                    </div>
                </div>
                <div className={styles.skeletonStatCards}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`${styles.skeleton} ${styles.skeletonStatCard}`} />
                    ))}
                </div>
            </main>
        </div>
    );
}
