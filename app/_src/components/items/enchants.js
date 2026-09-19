import styles from '../../styles/Items.module.css';
import StatFormatter from '../../utils/items/statFormatter';

export default function Enchants(data) {
    let formattedStats = StatFormatter.formatStats(data.item.stats, data.item.statColors);

    return <div className={styles.enchants}>{formattedStats}</div>;
}
