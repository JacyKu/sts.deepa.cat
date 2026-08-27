'use client';

import React from 'react';
import Select from 'react-select';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import DatabaseSkeleton from './databaseSkeleton';
import InfiniteScroll from './infiniteScroll';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import sf from '../styles/SearchForm.module.css';
import styles from '../styles/Database.module.css';
import { getStsBase } from '../utils/base';

const REGIONS = ['Valley', 'Isles', 'Ring', 'Darkest Depths', 'Celestial Zenith'];

// The same react-select look the rest of the app uses (builder, items page).
const selectTheme = (theme) => ({
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
});

const selectStyles = {
    container: (base) => ({ ...base, width: '100%' }),
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

// One applied filter: a category dropdown + a value control + a delete button,
// mirroring the items page's SelectWithTriggers rows. The Item category is a
// cascade: the slot dropdown fills the rest of the row, and once a slot is
// chosen a second row appears below with the actual item names.
function FilterRow({ categories, row, onChangeCategory, onChangeSlot, onChangeValue, onDelete, t, itemGroups, slotOptions }) {
    const cat = categories.find((c) => c.name === row.category);
    const optList = cat && cat.type === 'select' ? cat.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)) : [];
    const current = optList.find((o) => o.value === row.value) || null;
    const slot = slotOptions.find((o) => o.value === row.slot) || null;
    const itemOpts =
        row.slot && itemGroups[row.slot]
            ? [{ value: 'Any', label: t('database.any') }, ...itemGroups[row.slot].map((n) => ({ value: n, label: n }))]
            : [];
    const currentItem = itemOpts.find((o) => o.value === row.value) || null;
    return (
        <>
            <div className={sf.filterRow}>
                <div className={sf.filterMain}>
                    <Select
                        className={sf.categorySelect}
                        instanceId={`dbcat-${row.key}`}
                        options={categories.map((c) => ({ value: c.name, label: t(c.labelKey) }))}
                        value={cat ? { value: cat.name, label: t(cat.labelKey) } : null}
                        onChange={(opt) => onChangeCategory(row.key, opt ? opt.value : null)}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                    />
                    <div className={sf.selectorSelect}>
                        {cat && cat.type === 'select' && (
                            <Select
                                instanceId={`dbval-${row.key}`}
                                options={optList}
                                value={current}
                                onChange={(opt) => onChangeValue(row.key, opt ? opt.value : null)}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                theme={selectTheme}
                                styles={selectStyles}
                            />
                        )}
                        {cat && cat.type === 'cascade' && (
                            <Select
                                instanceId={`dbslot-${row.key}`}
                                options={slotOptions}
                                value={slot}
                                onChange={(opt) => onChangeSlot(row.key, opt ? opt.value : null)}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                theme={selectTheme}
                                styles={selectStyles}
                            />
                        )}
                        {cat && cat.type === 'text' && (
                            <input
                                className={styles.valueInput}
                                value={row.value || ''}
                                onChange={(e) => onChangeValue(row.key, e.target.value)}
                                placeholder={t(cat.labelKey)}
                                aria-label={t(cat.labelKey)}
                            />
                        )}
                    </div>
                </div>
                <input
                    type="button"
                    className={`${sf.deleteButton} ${sf.filterDelete}`}
                    value="X"
                    onClick={() => onDelete(row.key)}
                    aria-label="Remove filter"
                />
            </div>
            {cat && cat.type === 'cascade' && row.slot && (
                <div className={styles.subRow}>
                    <Select
                        instanceId={`dbitem-${row.key}`}
                        options={itemOpts}
                        value={currentItem}
                        onChange={(opt) => onChangeValue(row.key, opt ? opt.value : null)}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                    />
                </div>
            )}
        </>
    );
}

export default function DatabasePage({ classOptions, specMap, itemGroups }) {
    const { lang } = useLanguageContext();
    const t = (id) => (SupportedLanguages[lang] && SupportedLanguages[lang][id]) || id;

    const [base, setBase] = React.useState('/sts');
    const [user, setUser] = React.useState(null);
    const [authChecked, setAuthChecked] = React.useState(false);

    const [rows, setRows] = React.useState([{ key: 0, category: null, value: null }]); // applied filters
    const [searchName, setSearchName] = React.useState('');

    const [builds, setBuilds] = React.useState([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    const allSpecs = React.useMemo(() => [...new Set(Object.values(specMap).flat())], [specMap]);
    const slotOptions = React.useMemo(
        () => [
            { value: 'Mainhand', label: t('items.type.mainhand') },
            { value: 'Offhand', label: t('items.type.offhand') },
            { value: 'Helmet', label: t('items.type.helmet') },
            { value: 'Chestplate', label: t('items.type.chestplate') },
            { value: 'Leggings', label: t('items.type.leggings') },
            { value: 'Boots', label: t('items.type.boots') },
            { value: 'Charm', label: t('items.type.charm') },
        ],
        [t]
    );
    const categories = React.useMemo(
        () => [
            { name: 'class', labelKey: 'database.filters.class', type: 'select', options: classOptions },
            { name: 'region', labelKey: 'database.filters.region', type: 'select', options: REGIONS },
            { name: 'spec', labelKey: 'database.filters.spec', type: 'select', options: allSpecs },
            {
                name: 'hasCharms',
                labelKey: 'database.filters.hasCharms',
                type: 'select',
                options: [
                    { value: '1', label: t('database.yes') },
                    { value: '0', label: t('database.no') },
                ],
            },
            { name: 'item', labelKey: 'database.filters.item', type: 'cascade' },
            { name: 'skill', labelKey: 'database.filters.skill', type: 'text' },
            { name: 'author', labelKey: 'database.filters.author', type: 'text' },
            {
                name: 'sort',
                labelKey: 'database.filters.sort',
                type: 'select',
                options: [
                    { value: 'top', label: t('database.sort.top') },
                    { value: 'new', label: t('database.sort.new') },
                    { value: 'power', label: t('database.sort.power') },
                ],
            },
        ],
        [classOptions, allSpecs, t]
    );

    const rowsRef = React.useRef(rows);
    rowsRef.current = rows;
    const nameRef = React.useRef(searchName);
    nameRef.current = searchName;
    const pageRef = React.useRef(page);
    pageRef.current = page;
    const loadingRef = React.useRef(false);
    const loadSeq = React.useRef(0);

    React.useEffect(() => {
        setBase(getStsBase());
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                setUser(d && d.user ? d.user : null);
            })
            .catch(() => {})
            .finally(() => setAuthChecked(true));
    }, []);

    // Debounced refetch when filters change.
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            loadPage(1, true);
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, searchName]);

    function loadPage(nextPage, replace) {
        if (loadingRef.current && !replace) return;
        loadingRef.current = true;
        setLoading(true);
        const seq = ++loadSeq.current;
        // The sort order comes from a "Sort by" filter row; default: top.
        const sortRow = rowsRef.current.find((r) => r.category === 'sort' && r.value);
        const params = new URLSearchParams({
            page: String(nextPage),
            limit: '24',
            sort: sortRow ? sortRow.value : 'top',
        });
        if (nameRef.current) params.set('q', nameRef.current);
        // Last row wins per category. "Any" (the Item cascade's placeholder
        // value) means no item filter.
        const seen = new Set();
        for (const r of rowsRef.current) {
            if (!r.category || !r.value || r.value === 'Any' || seen.has(r.category)) continue;
            seen.add(r.category);
            if (r.category === 'hasCharms') params.set('has_charms', r.value);
            else params.set(r.category, r.value);
        }

        fetch(`/api/v1/builds/public?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                if (seq !== loadSeq.current) return;
                setBuilds((prev) => (replace ? d.builds : [...prev, ...d.builds]));
                setHasMore(d.hasMore);
                setPage(nextPage);
                setError(null);
            })
            .catch(() => {
                if (seq === loadSeq.current) setError('load');
            })
            .finally(() => {
                if (seq === loadSeq.current) {
                    loadingRef.current = false;
                    setLoading(false);
                }
            });
    }

    function addFilterRow() {
        setRows((prev) => [...prev, { key: Date.now(), category: null, value: null }]);
    }

    function changeCategory(key, category) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== key) return r;
                const cat = categories.find((c) => c.name === category);
                // The Item category starts on the Mainhand slot with "Any"
                // item; select categories start on their first option, like
                // the items page's value selects; text categories start empty.
                if (cat && cat.type === 'cascade') return { ...r, category, slot: 'Mainhand', value: 'Any' };
                const first =
                    cat && cat.type === 'select'
                        ? cat.options.map((o) => (typeof o === 'string' ? o : o.value))[0]
                        : null;
                return { ...r, category, value: first, slot: null };
            })
        );
    }

    function changeSlot(key, slot) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, slot, value: 'Any' } : r)));
    }

    function changeValue(key, value) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value: value || null } : r)));
    }

    function deleteRow(key) {
        setRows((prev) => prev.filter((r) => r.key !== key));
    }

    function searchNow() {
        setPage(1);
        loadPage(1, true);
    }

    function resetFilters() {
        // The debounced effect picks up the cleared rows/name and reloads.
        setRows([{ key: Date.now(), category: null, value: null }]);
        setSearchName('');
        setPage(1);
    }

    function toggleFavourite(buildId, favourite) {
        setBuilds((prev) =>
            prev.map((b) => {
                if (b.id !== buildId) return b;
                return { ...b, myFavourite: favourite, favouriteCount: b.favouriteCount + (favourite ? 1 : -1) };
            })
        );
    }

    const sortOptions = [
        { value: 'top', label: t('database.sort.top') },
        { value: 'new', label: t('database.sort.new') },
        { value: 'power', label: t('database.sort.power') },
    ];

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>
                <TranslatableText identifier="database.title" />
            </h1>

            {rows.length > 0 && (
                <div className={styles.rows}>
                    {rows.map((row) => (
                        <div className={styles.rowWrap} key={row.key}>
                            <FilterRow
                                categories={categories}
                                row={row}
                                onChangeCategory={changeCategory}
                                onChangeSlot={changeSlot}
                                onChangeValue={changeValue}
                                onDelete={deleteRow}
                                t={t}
                                itemGroups={itemGroups}
                                slotOptions={slotOptions}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.toolbar}>
                <input
                    type="button"
                    className={styles.addBtn}
                    value="+ Add"
                    aria-label={t('database.addFilter')}
                    onClick={addFilterRow}
                />
            </div>

            <input
                type="text"
                className={styles.searchName}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={t('database.filters.search')}
                aria-label={t('database.filters.search')}
            />

            <div className={sf.filterActions}>
                <input type="button" className={sf.submitButton} value="Search" onClick={searchNow} />
                <input type="button" className={sf.warningButton} value="Reset" onClick={resetFilters} />
            </div>

            {error ? (
                <p className={styles.error}>
                    <TranslatableText identifier="database.loadError" />
                </p>
            ) : builds.length === 0 && loading ? (
                <DatabaseSkeleton />
            ) : builds.length === 0 ? (
                <p className={styles.muted}>
                    <TranslatableText identifier="database.empty" />
                </p>
            ) : (
                <InfiniteScroll
                    className={styles.grid}
                    hasMore={hasMore}
                    next={() => loadPage(pageRef.current + 1, false)}
                >
                    {builds.map((build) => (
                        <BuildCard
                            key={build.id}
                            build={build}
                            user={authChecked ? user : null}
                            base={base}
                            onToggleFavourite={toggleFavourite}
                        />
                    ))}
                </InfiniteScroll>
            )}
        </div>
    );
}
