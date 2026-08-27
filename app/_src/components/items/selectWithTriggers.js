import Select from 'react-select';
import React from 'react';
import styles from '../../styles/SearchForm.module.css';
import { useLanguageContext } from '../../components/languageContext';
import SupportedLanguages from '../../utils/translation/languages';

const SelectWithTriggers = (props) => {
    const [firstChild, setFirstChild] = React.useState();
    const { lang } = useLanguageContext();
    const container = React.useRef();
    const spawnedRef = React.useRef(false);
    const opt = props.opts.map((o) => {
        return {
            value: o.name,
            label: o.translatableName
                ? SupportedLanguages[lang][o.translatableName]
                    ? SupportedLanguages[lang][o.translatableName]
                    : o.name
                : o.name,
        };
    });
    const selectedDefault = props.defaultValue ? props.defaultValue : null;

    function triggerSelection(event) {
        let selectedValue = event.value;
        let child = props.opts.find((o) => o.name == selectedValue).select(props.index);
        setFirstChild(child);
    }

    // Restored searches come in with the category + selected value already set:
    // spawn the value select immediately (with its cached default) instead of
    // waiting for the user to pick a category.
    React.useEffect(() => {
        if (spawnedRef.current) return;
        spawnedRef.current = true;
        if (!selectedDefault) return;
        const category = props.opts.find((o) => o.name === selectedDefault.value);
        if (!category) return;
        setFirstChild(category.select(props.index, props.childDefault));
    }, []);

    const handleDeleteItem = React.useCallback(() => {
        props.deleteCallback(props.index);
    }, [props]);

    return (
        <div className={`${props.className || ''} ${styles.filterRow}`.trim()}>
            <div className={styles.filterMain}>
                <Select
                    className={styles.categorySelect}
                    ref={props.reference}
                    instanceId={props.name}
                    name={props.name}
                    defaultValue={selectedDefault}
                    options={opt}
                    onChange={triggerSelection}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    theme={(theme) => ({
                        ...theme,
                        borderRadius: 0,
                        colors: {
                            ...theme.colors,
                            primary: 'var(--text-1)',
                            primary25: 'var(--surface-2)',
                            neutral0: 'var(--glass-1)',
                            neutral5: 'var(--glass-2)',
                            neutral10: 'var(--glass-2)',
                            neutral20: 'var(--control-border)',
                            neutral30: 'var(--control-border-hover)',
                            neutral60: 'var(--text-2)',
                            neutral80: 'var(--text-1)',
                        },
                    })}
                    styles={{
                        container: (base) => ({ ...base, width: '100%' }),
                        control: (base) => ({ ...base, minHeight: 42, height: 42 }),
                        valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
                        indicatorsContainer: (base) => ({ ...base, height: 42 }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        menu: (base) => ({ ...base, zIndex: 9999 }),
                    }}
                />

                <div ref={container} className={styles.selectorSelect}>
                    {firstChild}
                </div>
            </div>

            <input
                className={`${styles.deleteButton} ${styles.filterDelete}`}
                type="button"
                value="X"
                onClick={handleDeleteItem}
            />
        </div>
    );
};

export default SelectWithTriggers;
