import styles from '../../styles/CustomItems.module.css';
import { CustomItemCardSkeleton } from './customItemsSkeleton';

// Loading placeholder for /custom-items/[id]: same page/main wrapper and
// single .customItem card the share view renders.
export default function CustomItemSkeleton() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>Custom Item</h1>
                <CustomItemCardSkeleton />
            </main>
        </div>
    );
}
