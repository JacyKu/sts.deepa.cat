import Select from 'react-select';
import React from 'react';
import styles from '../../styles/SearchForm.module.css';
import { useLanguageContext } from '../../components/languageContext';
import SupportedLanguages from '../../utils/translation/languages';

// One filter row of the items search form: the category dropdown plus the
// value control it spawns. Fully controlled from the search form's state
// (like the database's FilterRow), so resetting a row is a plain state change
// instead of remounting selects or poking at the DOM.
const SelectWithTriggers = (props) => {
    const { lang } = useLanguageContext();
    const selected = props.selected || null;
    const category = props.opts.find((o) => o.name === props.category) || null;
    const options = props.opts.map((o) => ({
        value: o.name,
        label: o.translatableName
            ? SupportedLanguages[lang][o.translatableName]
                ? SupportedLanguages[lang][o.translatableName]
                : o.name
            : o.name,
    }));

    return (
        <div className={`${props.className || ''} ${styles.filterRow}`.trim()}>
            <div className={styles.filterMain}>
                <Select
                    className={styles.categorySelect}
                    ref={props.reference}
                    instanceId={props.name}
                    name={props.name}
                    value={category ? { value: category.name, label: options.find((o) => o.value === category.name)?.label || category.name } : null}
                    options={options}
                    onChange={(option) => props.onCategoryChange(option ? option.value : null)}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    theme={(theme) => ({
                        ...theme,
                        borderRadius: 0,
                        colors: {
                            ...theme.colors,
                            primary: 'var(--text-1)',
                            primary25: 'var(--surface-2)',
                            neutral0: 'var(--glass-menu)',
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

                <div className={styles.selectorSelect}>
                    {category &&
                        category.select({
                            uniqueKey: props.index,
                            selected,
                            onValueChange: props.onValueChange,
                        })}
                </div>
            </div>

            <input
                className={`${styles.deleteButton} ${styles.filterDelete}`}
                type="button"
                value="X"
                onClick={() => props.deleteCallback(props.index)}
                aria-label="Remove filter"
            />
        </div>
    );
};

export default SelectWithTriggers;
