import itemsStyles from '../styles/Items.module.css';
import styles from '../styles/Compare.module.css';

// Loading placeholder for /compare: same container, title and two picker
// panels (flex 1 1 360px / max-width 520) the real page renders.
export default function CompareSkeleton() {
    return (
        <div className={styles.container}>
            <h1 className={styles.pageTitle}>Build Comparison</h1>
            <div className={styles.pickers}>
                {['Build A', 'Build B'].map((label) => (
                    <div key={label} className={styles.picker}>
                        <span className={`${itemsStyles.skeleton} ${styles.skeletonPickerTitle}`} />
                        <div className={styles.pickerRow}>
                            <div className={`${itemsStyles.skeleton} ${styles.skeletonInput}`} />
                            <div className={`${itemsStyles.skeleton} ${styles.skeletonButton}`} />
                        </div>
                    </div>
                ))}
            </div>
            <div className={`${itemsStyles.skeleton} ${styles.skeletonHint}`} />
        </div>
    );
}
