import Select, { components } from 'react-select';
import React from 'react';
import { useLanguageContext } from '../../components/languageContext';
import SupportedLanguages from '../../utils/translation/languages';
import FloatingLabel from './floatingLabel';
import { useItemFavourites } from './itemFavouritesContext';
import itemsStyles from '../../styles/Items.module.css';

function convertItemNameForTranslationString(item) {
    if (!item) return '';
    return item
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

const SelectInput = (data) => {
    const { lang } = useLanguageContext();
    const { favouriteSet } = useItemFavourites();

    // Show a red heart next to options the user has favourited. Defaults to
    // matching on the option label (item base names / masterwork group
    // labels); callers whose option labels differ from the stored favourite
    // names (e.g. charms keyed by full item keys) can pass favouriteMatch.
    const isFavourite = (option) =>
        data.favouriteMatch ? data.favouriteMatch(option) : favouriteSet.has(option.label);

    const Option = (props) => (
        <components.Option {...props}>
            {isFavourite(props.data) && (
                <span className={itemsStyles.favOption} aria-hidden="true">
                    <svg viewBox="0 0 512 512" width="11" height="11">
                        <path
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="36"
                            d="M47.6 300.4 228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96.5 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"
                        />
                    </svg>
                </span>
            )}
            {props.children}
        </components.Option>
    );

    const options = data.sortableStats.map((item) => {
        if (typeof item == 'object') {
            return item;
        }

        if (!data.baseTranslationString) {
            return { value: item, label: item };
        }

        let translationString = `${data.baseTranslationString}.${convertItemNameForTranslationString(item)}`;
        return {
            value: item,
            label: SupportedLanguages[lang][translationString] ? SupportedLanguages[lang][translationString] : item,
        };
    });

    if (data.noneOption) {
        options.unshift({ value: 'None', label: 'None' });
    }

    // Cached restores pass the selected value (a plain string); resolve it to
    // the matching option object, defaulting to the first option otherwise.
    // Object defaults ({ value, label }) are accepted too - the builder's
    // class/spec selects pass them, and the option value is compared against
    // default.value (an object would never match a string option value).
    const defaultVal = data.default !== null && typeof data.default === 'object' ? data.default.value : data.default;
    const defaultOption = defaultVal
        ? options.find((o) => (typeof o === 'object' ? o.value === defaultVal : o === defaultVal)) || null
        : options[0];

    const select = (
        <Select
            ref={data.reference}
            instanceId={data.name}
            name={data.name}
            options={options}
            defaultValue={defaultOption}
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
                control: (base) => ({ ...base, minHeight: 42, height: 42 }),
                valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
                indicatorsContainer: (base) => ({ ...base, height: 42 }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 }),
            }}
            onChange={data.onChange}
            filterOption={data.filterOption}
            components={{ Option }}
        />
    );

    if (data.floatingLabel) {
        return <FloatingLabel label={data.floatingLabel}>{select}</FloatingLabel>;
    }

    return <div>{select}</div>;
};

export default SelectInput;
