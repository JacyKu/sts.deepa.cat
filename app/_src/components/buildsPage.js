'use client';

import React from 'react';
import Link from 'next/link';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import styles from '../styles/Builds.module.css';
import dbStyles from '../styles/Database.module.css';
import DatabaseSkeleton from './databaseSkeleton';
import { getStsBase } from '../utils/base';
import { decodeBuildName } from '../utils/builder/buildUrlCodec';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import sf from '../styles/SearchForm.module.css';
import { FilterRow, buildFilterCategories, buildSlotOptions } from './builds/filterRow';

export default function BuildsPage({ classOptions, specMap, itemGroups }) {
    const { lang } = useLanguageContext();
    const t = (id) => (SupportedLanguages[lang] && SupportedLanguages[lang][id]) || id;

    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [builds, setBuilds] = React.useState([]);
    const [loaded, setLoaded] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [editName, setEditName] = React.useState('');
    const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [base, setBase] = React.useState('/sts');

    // The same filter rows + search as the public database page. Rows are the
    // applied filters (category + value); sorting is a "sort" category row.
    const [rows, setRows] = React.useState([{ key: 0, category: null, value: null }]);
    const [searchName, setSearchName] = React.useState('');

    const slotOptions = React.useMemo(() => buildSlotOptions(t), [t]);
    const categories = React.useMemo(() => buildFilterCategories(classOptions, specMap, t), [classOptions, specMap, t]);

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
        fetch('/api/v1/builds/mine')
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
            return decodeBuildName(build.token) || 'Unnamed build';
        } catch (e) {
            return 'Unnamed build';
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
            if (!r.category || !r.value || r.value === 'Any' || r.category === 'sort' || applied[r.category]) continue;
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

        let sort = 'top';
        for (const r of rows) {
            if (r.category === 'sort' && r.value) {
                sort = r.value;
                break;
            }
        }
        return [...result].sort((a, b) => {
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
            if (sort === 'new') return bTime - aTime;
            if (sort === 'power') {
                const diff = (Number(b.power) || 0) - (Number(a.power) || 0);
                return diff !== 0 ? diff : bTime - aTime;
            }
            const favDiff = (b.favouriteCount || 0) - (a.favouriteCount || 0);
            return favDiff !== 0 ? favDiff : bTime - aTime;
        });
    }, [builds, rows, searchName]);

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
    }

    function startRename(build) {
        setEditingId(build.id);
        setEditName(displayName(build));
    }

    function submitRename(build) {
        const name = editName.trim();
        setEditingId(null);
        if (!name) return;
        fetch(`/api/v1/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => {
                setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, name } : b)));
            })
            .catch(() => setError('rename'));
    }

    function requestDelete(build) {
        if (confirmDeleteId === build.id) {
            fetch(`/api/v1/builds/${build.id}`, { method: 'DELETE' })
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
        fetch(`/api/v1/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicise: nextPublic, anonymous: build.anonymous }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                setBuilds((prev) =>
                    prev.map((b) => (b.id === build.id ? { ...b, isPublic: d.isPublic, anonymous: d.anonymous } : b))
                );
            })
            .catch(() => setError('publicise'));
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
        <div className="container-fluid">
            <main className={styles.page}>
                <h1 className={styles.title}>
                    <TranslatableText identifier="builds.title" />
                </h1>
                <div className={styles.subNav}>
                    <Link className={styles.subNavBtn} href={base + '/builds/favourites'}>
                        <TranslatableText identifier="database.favTitle" />
                    </Link>
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
                    <p className={styles.error} onClick={clearError} title="Dismiss">
                        <TranslatableText
                            identifier={
                                error === 'rename'
                                    ? 'builds.renameError'
                                    : error === 'delete'
                                      ? 'builds.deleteError'
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
                                value="+ Add"
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
                            <input type="button" className={sf.submitButton} value="Search" onClick={() => {}} />
                            <input type="button" className={sf.warningButton} value="Reset" onClick={resetFilters} />
                        </div>
                        {visibleBuilds.length === 0 ? (
                            <p className={styles.muted}>
                                <TranslatableText identifier="database.empty" />
                            </p>
                        ) : (
                            <div className={dbStyles.grid}>
                                {visibleBuilds.map((build) => (
                                    <div key={build.id} className={styles.cell}>
                                        <BuildCard build={build} user={user} base={base} onToggleFavourite={toggleFavourite}>
                                            <div className={styles.cardActions}>
                                                {editingId === build.id ? (
                                                    <input
                                                        type="text"
                                                        className={styles.nameInput}
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                submitRename(build);
                                                            }
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        onBlur={() => submitRename(build)}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className={`${styles.rowBtn}${
                                                                build.isPublic ? ` ${styles.rowBtnPublic}` : ''
                                                            }`}
                                                            onClick={stop(() => togglePublic(build))}
                                                            disabled={build.publicBusy}
                                                            title={build.isPublic ? 'Make private' : 'Publicise'}
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
                                                            title="Rename"
                                                        >
                                                            <TranslatableText identifier="builds.rename" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.rowBtn}
                                                            onClick={stop(() => requestDelete(build))}
                                                            title="Delete"
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
        </div>
    );
}