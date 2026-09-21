'use client';

import React from 'react';
import Link from 'next/link';
import Select from 'react-select';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import styles from '../styles/Builds.module.css';
import dbStyles from '../styles/Database.module.css';
import DatabaseSkeleton from './databaseSkeleton';
import FloatingLabel from './items/floatingLabel';
import { MyPagesTabs } from './databaseTabs';
import { getStsBase } from '../utils/base';
import { isSearchCacheEnabled, BUILDS_FILTERS_CACHE_KEY } from '../utils/cachePrefs';
import { decodeBuildName } from '../utils/builder/buildUrlCodec';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import { translate } from '../utils/translation/translate';
import sf from '../styles/SearchForm.module.css';
import {
    FilterRow,
    buildFilterCategories,
    buildSlotOptions,
    buildSortOptions,
    selectTheme,
    selectStyles,
} from './builds/filterRow';

// Inline rename field with its own local state so typing does not re-render
// the whole builds list (every BuildCard re-render is expensive). Commits
// once on Enter or blur; Escape cancels.
function RenameInput({ initialName, onCommit, onCancel }) {
    const [value, setValue] = React.useState(initialName);
    const done = React.useRef(false);

    function commit() {
        if (done.current) return;
        done.current = true;
        onCommit(value);
    }

    function cancel() {
        if (done.current) return;
        done.current = true;
        onCancel();
    }

    return (
        <input
            type="text"
            className={styles.nameInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancel();
                }
            }}
            onBlur={commit}
            autoFocus
            maxLength={50}
        />
    );
}

export default function BuildsPage({ classOptions, specMap, itemGroups, skillOptions = [], skillMap = null }) {
    const { lang } = useLanguageContext();
    const t = (id) => translate(lang, id);

    // Bulk (un)publicising: pick up to 20 builds and flip their visibility in
    // one action ("Select all" fills the batch from the visible list).
    const BULK_MAX = 20;

    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [builds, setBuilds] = React.useState([]);
    const [loaded, setLoaded] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [base, setBase] = React.useState('/sts');
    const [selectMode, setSelectMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState(() => new Set());
    const [bulkBusy, setBulkBusy] = React.useState(false);
    const [bulkFeedback, setBulkFeedback] = React.useState(null); // { action, done, failed }

    // The same filter rows + search as the public database page, plus the
    // fixed Sort by control above the "+ Add" button. Rows are the applied
    // filters (category + value).
    const [rows, setRows] = React.useState([{ key: 0, category: null, value: null }]);
    const [searchName, setSearchName] = React.useState('');
    const [sort, setSort] = React.useState('top');

    // The applied filters survive page switches (behind the "Cache searches"
    // setting, like the database and items pages).
    const suppressCacheSaveRef = React.useRef(false);
    React.useEffect(() => {
        if (!isSearchCacheEnabled()) return;
        try {
            const raw = window.localStorage.getItem(BUILDS_FILTERS_CACHE_KEY);
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
                    BUILDS_FILTERS_CACHE_KEY,
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

    React.useEffect(() => {
        setBase(getStsBase());
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                setUser(d && d.user ? d.user : null);
                setAuthChecked(true);
            })
            .catch(() => setAuthChecked(true));
    }, []);

    React.useEffect(() => {
        if (!authChecked || !user) return;
        fetch('/api/v2/builds/mine')
            .then((r) => (r.ok ? r.json() : { builds: [] }))
            .then((d) => {
                setBuilds(d.builds || []);
                setLoaded(true);
            })
            .catch(() => {
                setLoaded(true);
            });
    }, [authChecked, user]);

    function displayName(build) {
        if (build.name) return build.name;
        try {
            return decodeBuildName(build.token) || t('builds.unnamed');
        } catch (e) {
            return t('builds.unnamed');
        }
    }

    // Apply the search + filters + sort client-side over the already-fetched
    // list. Semantics mirror the database's server-side query: first row wins
    // per category, "Any" means no filter, and sort defaults to "top".
    const visibleBuilds = React.useMemo(() => {
        const query = searchName.trim().toLowerCase();
        let result = query ? builds.filter((b) => displayName(b).toLowerCase().includes(query)) : builds;

        const applied = {};
        for (const r of rows) {
            if (!r.category || !r.value || r.value === 'Any' || applied[r.category]) continue;
            applied[r.category] = r.value;
        }
        if (applied.class) result = result.filter((b) => (b.class || '') === applied.class);
        if (applied.region) result = result.filter((b) => (b.region || '') === applied.region);
        if (applied.spec) result = result.filter((b) => (b.spec || '') === applied.spec);
        if (applied.hasCharms !== undefined) {
            const want = applied.hasCharms === '1';
            result = result.filter((b) => Boolean(b.hasCharms) === want);
        }
        if (applied.item) {
            const item = applied.item.toLowerCase();
            result = result.filter((b) => ((b.itemsJson || '') + ' ').toLowerCase().includes(item));
        }
        if (applied.skill) {
            const skill = applied.skill.toLowerCase();
            result = result.filter((b) => ((b.skillsJson || '') + ' ').toLowerCase().includes(skill));
        }
        if (applied.author) {
            const author = applied.author.toLowerCase();
            result = result.filter((b) => ((b.authorName || '') + ' ').toLowerCase().includes(author));
        }

        return [...result].sort((a, b) => {
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
            if (sort === 'new') return bTime - aTime;
            const favDiff = (b.favouriteCount || 0) - (a.favouriteCount || 0);
            return favDiff !== 0 ? favDiff : bTime - aTime;
        });
    }, [builds, rows, searchName, sort]);

    function addFilterRow() {
        setRows((prev) => [...prev, { key: Date.now(), category: null, value: null }]);
    }

    function changeCategory(key, category) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== key) return r;
                const cat = categories.find((c) => c.name === category);
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

    function resetFilters() {
        setRows([{ key: Date.now(), category: null, value: null }]);
        setSearchName('');
        setSort('top');
        // Reset means "nothing applied": drop the cached search and skip the
        // save that the state change above would otherwise schedule.
        suppressCacheSaveRef.current = true;
        try {
            window.localStorage.removeItem(BUILDS_FILTERS_CACHE_KEY);
        } catch (e) {}
    }

    function startRename(build) {
        setEditingId(build.id);
    }

    function submitRename(build, rawName) {
        const name = rawName.trim();
        setEditingId(null);
        if (!name || name === displayName(build)) return;
        fetch(`/api/v2/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(r)))
            .then((d) => {
                // The server appends " (2)" when the account already uses the
                // name, so show the final name it returns.
                const finalName = d && d.name ? d.name : name;
                setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, name: finalName } : b)));
            })
            .catch((err) => {
                if (err && err.status === 409) setError('duplicate');
                else setError('rename');
            });
    }

    function requestDelete(build) {
        if (confirmDeleteId === build.id) {
            fetch(`/api/v2/builds/${build.id}`, { method: 'DELETE' })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
                .then(() => {
                    setBuilds((prev) => prev.filter((b) => b.id !== build.id));
                    setConfirmDeleteId(null);
                })
                .catch(() => setError('delete'));
        } else {
            setConfirmDeleteId(build.id);
            setTimeout(() => setConfirmDeleteId((cur) => (cur === build.id ? null : cur)), 2500);
        }
    }

    function togglePublic(build) {
        const nextPublic = !build.isPublic;
        setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, publicBusy: true } : b)));
        fetch(`/api/v2/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            // Publicising a build that isn't already anonymous leaves the flag
            // out so the server applies the account-wide anonymity preference.
            // Mod uploads carry no session, so their row flag stays 0 even
            // when the account prefers anonymity.
            body: JSON.stringify(
                nextPublic && !build.anonymous
                    ? { publicise: true }
                    : { publicise: nextPublic, anonymous: build.anonymous }
            ),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                setBuilds((prev) =>
                    prev.map((b) =>
                        b.id === build.id
                            ? { ...b, isPublic: d.isPublic, anonymous: d.anonymous, publicBusy: false }
                            : b
                    )
                );
            })
            .catch(() => {
                setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, publicBusy: false } : b)));
                setError('publicise');
            });
    }

    function toggleSelectMode() {
        setSelectMode((mode) => !mode);
        setSelectedIds(new Set());
        setBulkFeedback(null);
    }

    function toggleSelect(id) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < BULK_MAX) next.add(id);
            return next;
        });
        setBulkFeedback(null);
    }

    function selectAllVisible() {
        // Fills one batch (max 20) from the filtered list; run it again for
        // the next batch.
        setSelectedIds(new Set(visibleBuilds.slice(0, BULK_MAX).map((b) => b.id)));
        setBulkFeedback(null);
    }

    function clearSelection() {
        setSelectedIds(new Set());
        setBulkFeedback(null);
    }

    // (Un)publicise every selected build that isn't already in the target
    // state. The per-build endpoint validates ownership/profanity, so a bulk
    // action is just up to 20 of those in parallel; results are summarised.
    async function setPublicBulk(nextPublic) {
        if (bulkBusy) return;
        const targets = builds.filter((b) => selectedIds.has(b.id) && b.isPublic !== nextPublic);
        if (targets.length === 0) {
            setBulkFeedback({ action: nextPublic ? 'public' : 'private', done: 0, failed: 0 });
            return;
        }
        const ids = new Set(targets.map((b) => b.id));
        setBulkBusy(true);
        setBulkFeedback(null);
        setBuilds((prev) => prev.map((b) => (ids.has(b.id) ? { ...b, publicBusy: true } : b)));
        let done = 0;
        let failed = 0;
        await Promise.all(
            targets.map((build) =>
                fetch(`/api/v2/builds/${build.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    // Same rule as togglePublic: first-time publicises without
                    // an explicit anonymous=false fall back to the account
                    // preference on the server.
                    body: JSON.stringify(
                        nextPublic && !build.anonymous
                            ? { publicise: true }
                            : { publicise: nextPublic, anonymous: build.anonymous }
                    ),
                })
                    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
                    .then((d) => {
                        done += 1;
                        setBuilds((prev) =>
                            prev.map((b) =>
                                b.id === build.id
                                    ? { ...b, isPublic: d.isPublic, anonymous: d.anonymous, publicBusy: false }
                                    : b
                            )
                        );
                    })
                    .catch(() => {
                        failed += 1;
                        setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, publicBusy: false } : b)));
                    })
            )
        );
        setBulkBusy(false);
        setSelectedIds(new Set());
        setBulkFeedback({ action: nextPublic ? 'public' : 'private', done, failed });
    }

    function toggleFavourite(buildId, favourite) {
        setBuilds((prev) => prev.map((b) => (b.id === buildId ? { ...b, myFavourite: favourite } : b)));
    }

    // The buttons live inside the card, which is a link - stop the click
    // from navigating (or, on touch, from expanding the card first).
    const stop = (fn) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        fn();
    };

    function clearError() {
        setError(null);
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>
                    <TranslatableText identifier="builds.title" />
                </h1>
                <div className={styles.subNav}>
                    <MyPagesTabs active="builds" className={styles.subNavTabs} />
                </div>

                {!authChecked ? (
                    <DatabaseSkeleton />
                ) : !user ? (
                    <div className={styles.loginPrompt}>
                        <p>
                            <TranslatableText identifier="builds.loginRequired" />
                        </p>
                        <a className={styles.loginBtn} href="/api/auth/discord/login?next=/builds">
                            <TranslatableText identifier="auth.loginWithDiscord" />
                        </a>
                    </div>
                ) : error ? (
                    <p className={styles.error} onClick={clearError} title={t('common.dismiss')}>
                        <TranslatableText
                            identifier={
                                error === 'rename'
                                    ? 'builds.renameError'
                                    : error === 'delete'
                                      ? 'builds.deleteError'
                                      : error === 'duplicate'
                                        ? 'builds.duplicateName'
                                        : 'database.publiciseError'
                            }
                        />
                    </p>
                ) : !loaded ? (
                    <DatabaseSkeleton />
                ) : builds.length === 0 ? (
                    <p className={styles.muted}>
                        <TranslatableText identifier="builds.empty" />
                    </p>
                ) : (
                    <>
                        <div className={dbStyles.sortControl}>
                            <FloatingLabel label={t('database.filters.sort')}>
                                <Select
                                    instanceId="my-builds-sort"
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
                            <div className={dbStyles.rows}>
                                {rows.map((row) => (
                                    <div className={dbStyles.rowWrap} key={row.key}>
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
                        <div className={dbStyles.toolbar}>
                            <input
                                type="button"
                                className={dbStyles.addBtn}
                                value={'+ ' + t('common.add')}
                                aria-label={t('database.addFilter')}
                                onClick={addFilterRow}
                            />
                        </div>
                        <input
                            type="text"
                            className={dbStyles.searchName}
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder={t('database.filters.search')}
                            aria-label={t('database.filters.search')}
                        />
                        <div className={sf.filterActions}>
                            <input
                                type="button"
                                className={sf.submitButton}
                                value={t('common.search')}
                                onClick={() => {}}
                            />
                            <input
                                type="button"
                                className={sf.warningButton}
                                value={t('common.reset')}
                                onClick={resetFilters}
                            />
                        </div>
                        <div className={styles.bulkBar}>
                            <button
                                type="button"
                                className={styles.rowBtn}
                                onClick={toggleSelectMode}
                                aria-expanded={selectMode}
                            >
                                {selectMode ? t('common.cancel') : t('builds.select')}
                            </button>
                            {selectMode && (
                                <>
                                    <span className={styles.bulkCount} title={t('builds.maxPerAction')}>
                                        {selectedIds.size} / {BULK_MAX}
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.rowBtn}
                                        onClick={() => setPublicBulk(true)}
                                        disabled={bulkBusy || selectedIds.size === 0}
                                        title={t('database.publicise')}
                                    >
                                        {t('database.publicise')}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.rowBtn}
                                        onClick={() => setPublicBulk(false)}
                                        disabled={bulkBusy || selectedIds.size === 0}
                                        title={t('database.unpublish')}
                                    >
                                        {t('database.unpublish')}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.rowBtn}
                                        onClick={selectAllVisible}
                                        disabled={bulkBusy}
                                    >
                                        {t('builds.selectAll')}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.rowBtn}
                                        onClick={clearSelection}
                                        disabled={bulkBusy || selectedIds.size === 0}
                                    >
                                        {t('builds.clearSelection')}
                                    </button>
                                </>
                            )}
                        </div>
                        {bulkFeedback && (
                            <p className={styles.bulkFeedback} role="status">
                                <b>
                                    {bulkFeedback.action === 'public'
                                        ? t('builds.bulkPublicised')
                                        : t('builds.bulkUnpublicised')}
                                </b>{' '}
                                {bulkFeedback.done}
                                {bulkFeedback.failed > 0 ? (
                                    <>
                                        {' · '}
                                        <b>{t('builds.bulkFailed')}</b> {bulkFeedback.failed}
                                    </>
                                ) : null}
                            </p>
                        )}
                        {visibleBuilds.length === 0 ? (
                            <p className={styles.muted}>
                                <TranslatableText identifier="database.empty" />
                            </p>
                        ) : (
                            <div className={dbStyles.grid}>
                                {visibleBuilds.map((build) => (
                                    <div key={build.id} className={styles.cell}>
                                        <BuildCard
                                            build={build}
                                            user={user}
                                            base={base}
                                            onToggleFavourite={toggleFavourite}
                                        >
                                            <div className={styles.cardActions}>
                                                {editingId === build.id ? (
                                                    <RenameInput
                                                        initialName={displayName(build)}
                                                        onCommit={(name) => submitRename(build, name)}
                                                        onCancel={() => setEditingId(null)}
                                                    />
                                                ) : (
                                                    <>
                                                        {selectMode && (
                                                            <label
                                                                className={styles.selectBox}
                                                                onClick={(event) => event.stopPropagation()}
                                                                title={t('builds.selectBuild')}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(build.id)}
                                                                    disabled={
                                                                        !selectedIds.has(build.id) &&
                                                                        selectedIds.size >= BULK_MAX
                                                                    }
                                                                    onChange={() => toggleSelect(build.id)}
                                                                    aria-label={t('builds.selectBuild')}
                                                                />
                                                            </label>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className={`${styles.rowBtn}${
                                                                build.isPublic ? ` ${styles.rowBtnPublic}` : ''
                                                            }`}
                                                            onClick={stop(() => togglePublic(build))}
                                                            disabled={build.publicBusy}
                                                            title={
                                                                build.isPublic
                                                                    ? t('database.unpublish')
                                                                    : t('database.publicise')
                                                            }
                                                        >
                                                            {build.isPublic ? (
                                                                <TranslatableText identifier="database.publicBadge" />
                                                            ) : (
                                                                <TranslatableText identifier="database.publicise" />
                                                            )}
                                                            {build.isPublic && build.anonymous && (
                                                                <span className={styles.anonBadge}>
                                                                    <TranslatableText identifier="database.anonBadge" />
                                                                </span>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.rowBtn}
                                                            onClick={stop(() => startRename(build))}
                                                            title={t('builds.rename')}
                                                        >
                                                            <TranslatableText identifier="builds.rename" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                                                            onClick={stop(() => requestDelete(build))}
                                                            title={t('builds.delete')}
                                                        >
                                                            {confirmDeleteId === build.id ? (
                                                                <TranslatableText identifier="builds.confirmDelete" />
                                                            ) : (
                                                                <TranslatableText identifier="builds.delete" />
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </BuildCard>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
        </main>
    );
}
