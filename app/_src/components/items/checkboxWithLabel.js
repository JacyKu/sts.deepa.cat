import styles from '../../styles/Items.module.css';
import TranslatableText from '../translatableText';
import TranslatableEnchant from '../translatableEnchant';

export default function CheckboxWithLabel(data) {
    // The input's form name drives the enabledBoxes key the stats engine
    // reads; it normally mirrors the label, but callers can pin it when the
    // label carries extra text (e.g. "Frenzy (Lv 2)" -> "frenzy").
    const inputName = data.inputName || data.name.toLowerCase();
    return (
        <div className={styles.checkboxWithLabel}>
            <input
                type="checkbox"
                onChange={data.onChange ? data.onChange : undefined}
                id={inputName}
                name={inputName}
                defaultChecked={data.checked}
                disabled={data.disabled}
            />
            <label htmlFor={inputName}>
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
