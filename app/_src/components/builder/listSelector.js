import styles from '../../styles/ListSelector.module.css';
import itemsStyles from '../../styles/Items.module.css';
import Percentage from '../../utils/builder/percentage';
import TranslatableText from '../translatableText';
import React from 'react';

export default function ListSelector({ update, translatableName, description }) {
    const [entries, setEntries] = React.useState([]);

    const inputRef = React.useRef();

    function processUpdate(updatedEntries) {
        setEntries(updatedEntries);
        update(updatedEntries);
    }

    function addEntry(isPercent) {
        let input = inputRef.current.value;

        if (isNaN(input)) {
            return;
        }

        let newEntryValue = new Percentage(input, isPercent);
        processUpdate([...entries, newEntryValue]);
    }

    function deleteEntry(i) {
        processUpdate(entries.filter((_, index) => index != i));
    }

    return (
        <div className={`${styles.listSelectorContainer} p-1`}>
            <p className={`${styles.name} m-0 mb-1`}>
                <span className={itemsStyles.enchantTooltip}>
                    <TranslatableText identifier={translatableName}></TranslatableText>
                    {description && <span className={itemsStyles.enchantTooltipText}>{description}</span>}
                </span>
            </p>
            <div className={`${styles.listSelectorInputs} justify-content-center`}>
                <input className={styles.entryInput} type="text" ref={inputRef}></input>
                <button className={styles.button} onClick={() => addEntry(false)}>
                    +
                </button>
            </div>
            <div className={styles.listSelectorList}>
                {entries.map((entry, index) => (
                    <span key={index} className={styles.entry} onClick={() => deleteEntry(index)}>
                        {`${entry.val.toFixed(2)}`}
                    </span>
                ))}
            </div>
        </div>
    );
}
