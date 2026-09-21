import Select, { components } from 'react-select';
import React from 'react';
import { useLanguageContext } from '../../components/languageContext';
import SupportedLanguages from '../../utils/translation/languages';
import FloatingLabel from './floatingLabel';
import { useItemFavourites } from './itemFavouritesContext';
import { useTranslation } from '../useTranslation';
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

// Static select chrome, hoisted so react-select is not handed new theme/style
// functions on every render.
const SELECT_THEME = (theme) => ({
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
});

const SELECT_STYLES = {
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

// Item selectors can hold over a thousand options (the builder's mainhand
// list alone is ~1030), and react-select renders every one of them into the
// DOM even though only a handful are visible - opening and typing in those
// menus was expensive. This renders just the visible slice, with spacer divs
// standing in for the rest; keyboard focus scrolls the window so arrow
// navigation keeps working.
const OPTION_HEIGHT = 40;
const MENU_MAX_HEIGHT = 300;

export function WindowedMenuList(props) {
    const scrollRef = React.useRef(null);
    const [scrollTop, setScrollTop] = React.useState(0);
    const children = React.Children.toArray(props.children);
    const options = props.options || [];
    // Grouped menus interleave headings with options, so only windowing a
    // flat list (children 1:1 with options) is safe.
    const canWindow = children.length === options.length && children.length > 100;
    const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

    // New filtered list: start from the top again.
    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        setScrollTop(0);
    }, [options]);

    // Keep the keyboard-focused option inside the rendered slice. When the
    // focused option is in the slice we find it by identity; once it moves
    // past the slice, compare its original-list index with the slice edges
    // and step the window towards it.
    useIsomorphicLayoutEffect(() => {
        if (!canWindow) return;
        const el = scrollRef.current;
        if (!el) return;

        let index = -1;
        let firstData = null;
        let lastData = null;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const data = child && child.props ? child.props.data : null;
            if (i === 0) firstData = data;
            lastData = data;
            if ((child.props && child.props.isFocused) || (props.focusedOption && data === props.focusedOption)) {
                index = i;
                break;
            }
        }

        if (index < 0 && props.focusedOption && options.length) {
            const focusedIndex = options.indexOf(props.focusedOption);
            const firstIndex = firstData ? options.indexOf(firstData) : -1;
            const lastIndex = lastData ? options.indexOf(lastData) : -1;
            if (focusedIndex >= 0 && firstIndex >= 0 && lastIndex >= 0) {
                if (focusedIndex > lastIndex) el.scrollTop += OPTION_HEIGHT;
                else if (focusedIndex < firstIndex) el.scrollTop -= OPTION_HEIGHT;
            }
            return;
        }
        if (index < 0) return;

        const top = index * OPTION_HEIGHT;
        const bottom = top + OPTION_HEIGHT;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (bottom > el.scrollTop + MENU_MAX_HEIGHT) el.scrollTop = bottom - MENU_MAX_HEIGHT;
    });

    // react-select's MenuList only forwards innerProps to the DOM, so the
    // scroll listener is attached to the element directly.
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el || !canWindow) return undefined;
        const onScroll = () => setScrollTop(el.scrollTop);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [canWindow]);

    if (!canWindow) {
        return <components.MenuList {...props} />;
    }

    const start = Math.max(0, Math.floor(scrollTop / OPTION_HEIGHT) - 3);
    const end = Math.min(children.length, Math.ceil((scrollTop + MENU_MAX_HEIGHT) / OPTION_HEIGHT) + 3);

    return (
        <components.MenuList {...props} innerRef={scrollRef}>
            <div style={{ height: start * OPTION_HEIGHT }} aria-hidden="true" />
            {children.slice(start, end)}
            <div style={{ height: (children.length - end) * OPTION_HEIGHT }} aria-hidden="true" />
        </components.MenuList>
    );
}

const SelectInput = (data) => {
    const { lang } = useLanguageContext();
    const t = useTranslation();
    const { favouriteSet } = useItemFavourites();

    // Show a red heart next to options the user has favourited. Defaults to
    // matching on the option label (item base names / masterwork group
    // labels); callers whose option labels differ from the stored favourite
    // names (e.g. charms keyed by full item keys) can pass favouriteMatch.
    const favouriteMatch = data.favouriteMatch;
    const isFavourite = React.useCallback(
        (option) => (favouriteMatch ? favouriteMatch(option) : favouriteSet.has(option.label)),
        [favouriteMatch, favouriteSet]
    );

    // Stable component identity: a fresh Option function on every render made
    // react-select remount every rendered option.
    const Option = React.useCallback(
        (props) => (
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
        ),
        [isFavourite]
    );
    const selectComponents = React.useMemo(() => ({ Option, MenuList: WindowedMenuList }), [Option]);

    // The option objects are rebuilt only when their source list, language or
    // translation string actually change instead of on every render.
    const options = React.useMemo(() => {
        const list = (data.sortableStats || []).map((item) => {
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
            list.unshift({ value: 'None', label: t('common.none') });
        }
        return list;
    }, [data.sortableStats, data.baseTranslationString, data.noneOption, lang, t]);

    // Cached restores pass the selected value (a plain string); resolve it to
    // the matching option object, defaulting to the first option otherwise.
    // Object defaults ({ value, label }) are accepted too - the builder's
    // class/spec selects pass them, and the option value is compared against
    // default.value (an object would never match a string option value).
    const findOption = (value) =>
        options.find((o) =>
            typeof o === 'object' ? String(o.value) === String(value) : String(o) === String(value)
        ) || null;
    // Controlled mode: callers that pass `value` own the selection (the search
    // filter rows do), so resetting is just a state change in the parent
    // instead of remounting the select.
    const controlled = data.value !== undefined;
    const defaultVal = data.default !== null && typeof data.default === 'object' ? data.default.value : data.default;
    const defaultOption = defaultVal ? findOption(defaultVal) : options[0];

    // widthToOptions: size the control - and the menu, which follows the
    // control's width - to the widest option label instead of the current
    // value, so longer entries (class names differ per language) are not
    // clipped. The labels are measured with the control's own font via canvas,
    // plus the value paddings, dropdown indicator and borders.
    const SELECT_CHROME_WIDTH = 60;
    const widthWrapperRef = React.useRef(null);
    const [minWidth, setMinWidth] = React.useState(null);
    React.useEffect(() => {
        if (!data.widthToOptions) return;
        const el = widthWrapperRef.current;
        if (!el) return;
        const style = window.getComputedStyle(el);
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        let widest = 0;
        for (const option of options) {
            const label = option && typeof option === 'object' ? option.label : option;
            widest = Math.max(widest, ctx.measureText(String(label ?? '')).width);
        }
        setMinWidth(Math.ceil(widest) + SELECT_CHROME_WIDTH);
    }, [data.widthToOptions, options]);

    const select = (
        <Select
            ref={data.reference}
            instanceId={data.name}
            name={data.name}
            options={options}
            {...(controlled
                ? { value: data.value === null ? null : findOption(data.value) }
                : { defaultValue: defaultOption })}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            theme={SELECT_THEME}
            styles={SELECT_STYLES}
            onChange={data.onChange}
            filterOption={data.filterOption}
            components={selectComponents}
        />
    );

    const wrapper = (
        <div ref={widthWrapperRef} style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
            {select}
        </div>
    );

    if (data.floatingLabel) {
        return <FloatingLabel label={data.floatingLabel}>{wrapper}</FloatingLabel>;
    }

    return wrapper;
};

export default SelectInput;
