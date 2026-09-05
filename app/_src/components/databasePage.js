'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import DatabaseSkeleton from './databaseSkeleton';
import InfiniteScroll from './infiniteScroll';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import sf from '../styles/SearchForm.module.css';
import styles from '../styles/Database.module.css';
import { getStsBase } from '../utils/base';
import { FilterRow, buildFilterCategories, buildSlotOptions } from './builds/filterRow';

// Pending comparison picks, shared with the /compare page: entries carry the
// build's own /b/v<version>/<id> URL + a display name. Two picks jump
// straight to the comparison; one leaves a dock so another can be added.
const COMPARE_PICKS_KEY = 'sts-compare-picks';

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

    const slotOptions = React.useMemo(() => buildSlotOptions(t), [t]);
    const categories = React.useMemo(() => buildFilterCategories(classOptions, specMap, t), [classOptions, specMap, t]);

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

    const toggleCompare = React.useCallback((build) => {
        const url = build.url;
        const current = comparePicks.some((p) => p.url === url);
        let next = comparePicks.filter((p) => p.url !== url);
        if (!current) {
            const display = build.name || [build.class, build.spec].filter(Boolean).join(' · ') || `Build ${build.id}`;
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
    }, [comparePicks, router]);

    function goCompareSingle() {
        if (comparePicks.length === 0) return;
        const qs = new URLSearchParams({ left: comparePicks[0].url });
        persistCompare([]);
        router.push('/compare?' + qs.toString());
    }

    function clearCompare() {
        persistCompare([]);
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
                            onAddCompare={toggleCompare}
                            compareActive={comparePicks.some((p) => p.url === build.url)}
                        />
                    ))}
                </InfiniteScroll>
            )}

            {comparePicks.length > 0 && (
                <div className={styles.compareDock}>
                    <div className={styles.compareDockInfo}>
                        <span className={styles.compareDockTitle}>Compare</span>
                        {comparePicks.map((p) => (
                            <span key={p.url} className={styles.compareDockPick}>
                                {p.name}
                            </span>
                        ))}
                        <span className={styles.compareDockHint}>
                            {comparePicks.length === 1 ? 'Pick one more build to compare' : ''}
                        </span>
                    </div>
                    <div className={styles.compareDockActions}>
                        <button type="button" className={styles.compareDockBtn} onClick={goCompareSingle}>
                            Compare
                        </button>
                        <button
                            type="button"
                            className={styles.compareDockClear}
                            onClick={clearCompare}
                            aria-label="Clear comparison picks"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
