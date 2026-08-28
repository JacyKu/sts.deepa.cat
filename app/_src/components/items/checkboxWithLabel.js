import styles from '../../styles/Items.module.css';
import TranslatableText from '../translatableText';
import TranslatableEnchant from '../translatableEnchant';

export default function CheckboxWithLabel(data) {
    return (
        <div className={styles.checkboxWithLabel}>
            <input
                type="checkbox"
                onChange={data.onChange ? data.onChange : undefined}
                id={data.name.toLowerCase()}
                name={data.name.toLowerCase()}
                defaultChecked={data.checked}
                disabled={data.disabled}
            />
            <label htmlFor={data.name.toLowerCase()}>
                {data.enchantName ? (
                    <TranslatableEnchant title={data.enchantName}>{data.name}</TranslatableEnchant>
                ) : data.translatableName ? (
                    <TranslatableText identifier={data.translatableName}></TranslatableText>
                ) : (
                    data.name
                )}
            </label>
        </div>
    );
}
