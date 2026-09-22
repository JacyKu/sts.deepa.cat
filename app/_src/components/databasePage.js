'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import DatabaseSkeleton from './databaseSkeleton';
import InfiniteScroll from './infiniteScroll';
import DatabaseTabs from './databaseTabs';
import FloatingLabel from './items/floatingLabel';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import { translate } from '../utils/translation/translate';
import sf from '../styles/SearchForm.module.css';
import styles from '../styles/Database.module.css';
import { getStsBase } from '../utils/base';
import { isSearchCacheEnabled, DATABASE_FILTERS_CACHE_KEY } from '../utils/cachePrefs';
import {
    FilterRow,
    buildFilterCategories,
    buildSlotOptions,
    buildSortOptions,
    selectTheme,
    selectStyles,
} from './builds/filterRow';

// Pending comparison picks, shared with the /compare page: entries carry the
// build's own /b/v<version>/<id> URL + a display name. Two picks jump
// straight to the comparison; one leaves a dock so another can be added.
const COMPARE_PICKS_KEY = 'sts-compare-picks';

export default function DatabasePage({ classOptions, specMap, itemGroups, skillOptions = [], skillMap = null }) {
    const { lang } = useLanguageContext();
    const t = (id) => translate(lang, id);

    const base = getStsBase();
    const [user, setUser] = React.useState(null);
    const [authChecked, setAuthChecked] = React.useState(false);

    const [rows, setRows] = React.useState([{ key: 0, category: null, value: null }]); // applied filters
    const [searchName, setSearchName] = React.useState('');
    // Sort is a fixed control above the filter rows, not an addable filter.
    const [sort, setSort] = React.useState('top');

    // The applied filters survive page switches (behind the "Cache searches"
    // setting, like the items page search). Restore once after mount - the
    // debounced load effect below then fetches the restored search.
    const suppressCacheSaveRef = React.useRef(false);
    React.useEffect(() => {
        if (!isSearchCacheEnabled()) return;
        try {
            const raw = window.localStorage.getItem(DATABASE_FILTERS_CACHE_KEY);
            if (!raw) return;
            const cache = JSON.parse(raw);
            if (cache && typeof cache.searchName === 'string' && cache.searchName) setSearchName(cache.searchName);
            if (cache && (cache.sort === 'top' || cache.sort === 'new')) setSort(cache.sort);
            if (cache && Array.isArray(cache.rows) && cache.rows.length > 0) {
                const now = Date.now();
                setRows(
                    cache.rows.map((row, i) => ({
                        key: now + i,
                        category: row.category || null,
                        value: row.value ?? null,
                        slot: row.slot || null,
                    }))
                );
            }
        } catch (e) {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist filter edits (debounced) so they are there on the next visit.
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (suppressCacheSaveRef.current) {
                suppressCacheSaveRef.current = false;
                return;
            }
            if (!isSearchCacheEnabled()) return;
            try {
                window.localStorage.setItem(
                    DATABASE_FILTERS_CACHE_KEY,
                    JSON.stringify({
                        rows: rows.map(({ key, ...rest }) => rest),
                        searchName,
                        sort,
                    })
                );
            } catch (e) {}
        }, 500);
        return () => clearTimeout(timer);
    }, [rows, searchName, sort]);

    const [builds, setBuilds] = React.useState([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    const slotOptions = React.useMemo(() => buildSlotOptions(t), [t]);
    // The Skill filter narrows to the selected Class filter's skills (base +
    // its spec skills, plus the class-independent CZ/DD abilities).
    const selectedClass = React.useMemo(() => {
        for (const r of rows) {
            if (r.category === 'class' && r.value) return r.value;
        }
        return null;
    }, [rows]);
    const categories = React.useMemo(
        () =>
            buildFilterCategories(classOptions, specMap, t, {
                includeSort: false,
                skillOptions,
                skillMap,
                selectedClass,
            }),
        [classOptions, specMap, t, skillOptions, skillMap, selectedClass]
    );

    // Drop a Skill filter value that the newly selected class doesn't offer
    // (it would otherwise keep filtering invisibly).
    React.useEffect(() => {
        if (!selectedClass || !skillMap) return;
        const valid = new Set(skillMap[selectedClass] || []);
        setRows((prev) => {
            let changed = false;
            const next = prev.map((r) => {
                if (r.category === 'skill' && r.value && !valid.has(r.value)) {
                    changed = true;
                    return { ...r, value: null };
                }
                return r;
            });
            return changed ? next : prev;
        });
    }, [selectedClass, skillMap]);
    const sortOptions = React.useMemo(() => buildSortOptions(t), [t]);

    const rowsRef = React.useRef(rows);
    rowsRef.current = rows;
    const nameRef = React.useRef(searchName);
    nameRef.current = searchName;
    const sortRef = React.useRef(sort);
    sortRef.current = sort;
    const pageRef = React.useRef(page);
    pageRef.current = page;
    const loadingRef = React.useRef(false);
    const loadSeq = React.useRef(0);

    React.useEffect(() => {
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
    }, [rows, searchName, sort]);

    function loadPage(nextPage, replace) {
        if (loadingRef.current && !replace) return;
        loadingRef.current = true;
        setLoading(true);
        const seq = ++loadSeq.current;
        const params = new URLSearchParams({
            page: String(nextPage),
            limit: '24',
            sort: sortRef.current,
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

        fetch(`/api/v2/builds/public?${params.toString()}`)
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
        setSort('top');
        setPage(1);
        // Reset means "nothing applied": drop the cached search and skip the
        // save that the state change above would otherwise schedule.
        suppressCacheSaveRef.current = true;
        try {
            window.localStorage.removeItem(DATABASE_FILTERS_CACHE_KEY);
        } catch (e) {}
    }

    const toggleFavourite = React.useCallback((buildId, favourite) => {
        setBuilds((prev) =>
            prev.map((b) => {
                if (b.id !== buildId) return b;
                return { ...b, myFavourite: favourite, favouriteCount: b.favouriteCount + (favourite ? 1 : -1) };
            })
        );
    }, []);

    // Comparison picking: builds are collected in localStorage, shown on a
    // small dock, and two picks auto-navigate to /compare.
    const router = useRouter();
    const [comparePicks, setComparePicks] = React.useState([]);
    React.useEffect(() => {
        try {
            const raw = window.localStorage.getItem(COMPARE_PICKS_KEY);
            if (raw) setComparePicks(JSON.parse(raw).slice(0, 2));
        } catch (e) {}
    }, []);

    function persistCompare(next) {
        setComparePicks(next);
        try {
            if (next.length > 0) window.localStorage.setItem(COMPARE_PICKS_KEY, JSON.stringify(next));
            else window.localStorage.removeItem(COMPARE_PICKS_KEY);
        } catch (e) {}
    }

    const toggleCompare = React.useCallback(
        (build) => {
            const url = build.url;
            const current = comparePicks.some((p) => p.url === url);
            let next = comparePicks.filter((p) => p.url !== url);
            if (!current) {
                const display =
                    build.name ||
                    [build.class, build.spec].filter(Boolean).join(' · ') ||
                    `${t('builds.fallbackName')} ${build.id}`;
                next = [...next, { url, id: build.id, name: display }];
            }
            persistCompare(next);
            if (next.length === 2) {
                // Both sides picked: go compare. Clear the dock so the next pair
                // starts fresh.
                const qs = new URLSearchParams({
                    left: next[0].url,
                    right: next[1].url,
                });
                persistCompare([]);
                router.push('/compare?' + qs.toString());
            }
        },
        [comparePicks, router, t]
    );

    function goCompareSingle() {
        if (comparePicks.length === 0) return;
        const qs = new URLSearchParams({ left: comparePicks[0].url });
        persistCompare([]);
        router.push('/compare?' + qs.toString());
    }

    function clearCompare() {
        persistCompare([]);
    }

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>
                <TranslatableText identifier="database.title" />
            </h1>
            <DatabaseTabs active="builds" />

            <div className={styles.sortControl}>
                <FloatingLabel label={t('database.filters.sort')}>
                    <Select
                        instanceId="db-sort"
                        options={sortOptions}
                        value={sortOptions.find((o) => o.value === sort) || null}
                        onChange={(opt) => setSort(opt ? opt.value : 'top')}
                        isSearchable={false}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                    />
                </FloatingLabel>
            </div>

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
                    value={'+ ' + t('common.add')}
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
                <input type="button" className={sf.submitButton} value={t('common.search')} onClick={searchNow} />
                <input type="button" className={sf.warningButton} value={t('common.reset')} onClick={resetFilters} />
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
                            onAddCompare={toggleCompare}
                            compareActive={comparePicks.some((p) => p.url === build.url)}
                        />
                    ))}
                </InfiniteScroll>
            )}

            {comparePicks.length > 0 && (
                <div className={styles.compareDock}>
                    <div className={styles.compareDockInfo}>
                        <span className={styles.compareDockTitle}>{t('compare.action')}</span>
                        {comparePicks.map((p) => (
                            <span key={p.url} className={styles.compareDockPick}>
                                {p.name}
                            </span>
                        ))}
                        <span className={styles.compareDockHint}>
                            {comparePicks.length === 1 ? t('compare.dockHint') : ''}
                        </span>
                    </div>
                    <div className={styles.compareDockActions}>
                        <button type="button" className={styles.compareDockBtn} onClick={goCompareSingle}>
                            {t('compare.action')}
                        </button>
                        <button
                            type="button"
                            className={styles.compareDockClear}
                            onClick={clearCompare}
                            aria-label={t('compare.clearPicks')}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
