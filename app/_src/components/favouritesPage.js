'use client';

import React from 'react';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import InfiniteScroll from './infiniteScroll';
import styles from '../styles/Database.module.css';
import sf from '../styles/SearchForm.module.css';
import DatabaseSkeleton from './databaseSkeleton';
import DatabaseTabs from './databaseTabs';
import { MyPagesTabs } from './databaseTabs';
import { getStsBase } from '../utils/base';
import { useLanguageContext } from './languageContext';
import SupportedLanguages from '../utils/translation/languages';
import { translate } from '../utils/translation/translate';

export default function FavouritesPage() {
    const { lang } = useLanguageContext();
    const t = (id) => translate(lang, id);

    const [base, setBase] = React.useState('/sts');
    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [builds, setBuilds] = React.useState([]);
    const [searchName, setSearchName] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(true);
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(false);
    const [baseLoaded, setBaseLoaded] = React.useState(false);

    React.useEffect(() => {
        setBase(getStsBase());
        setBaseLoaded(true);
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                setUser(d && d.user ? d.user : null);
                setAuthChecked(true);
            })
            .catch(() => setAuthChecked(true));
    }, []);

    const loadingRef = React.useRef(false);
    const pageRef = React.useRef(page);
    pageRef.current = page;
    const nameRef = React.useRef(searchName);
    nameRef.current = searchName;
    const loadSeq = React.useRef(0);

    function loadPage(nextPage, replace) {
        if (loadingRef.current && !replace) return;
        loadingRef.current = true;
        const seq = ++loadSeq.current;
        const params = new URLSearchParams({ page: String(nextPage), limit: '24' });
        if (nameRef.current.trim()) params.set('q', nameRef.current.trim());
        fetch(`/api/v1/builds/favourites?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                if (seq !== loadSeq.current) return;
                setBuilds((prev) => (replace ? d.builds : [...prev, ...d.builds]));
                setHasMore(d.hasMore);
                setPage(nextPage);
            })
            .catch(() => {
                if (seq === loadSeq.current) setError(true);
            })
            .finally(() => {
                if (seq === loadSeq.current) {
                    loadingRef.current = false;
                    setLoaded(true);
                }
            });
    }

    React.useEffect(() => {
        if (!authChecked || !user || !baseLoaded) return;
        setLoaded(false);
        loadPage(1, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authChecked, user, baseLoaded]);

    // Debounced refetch when the search name changes (same as the database
    // pages). The first run is skipped: the auth effect above loads the list.
    const searchMounted = React.useRef(false);
    React.useEffect(() => {
        if (!searchMounted.current) {
            searchMounted.current = true;
            return;
        }
        const timer = setTimeout(() => loadPage(1, true), 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchName]);

    function searchNow() {
        loadPage(1, true);
    }

    function resetSearch() {
        setSearchName('');
    }

    function toggleFavourite(buildId) {
        setBuilds((prev) => prev.filter((b) => b.id !== buildId));
    }

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>
                <TranslatableText identifier="database.favTitle" />
            </h1>
            <MyPagesTabs active="favourites" className={styles.myTabs} />
            {user && (
                <DatabaseTabs
                    active="builds"
                    className={styles.favTabs}
                    tabs={[
                        { key: 'builds', label: t('database.tabs.builds'), href: `${base}/builds/favourites` },
                        {
                            key: 'custom-items',
                            label: t('database.tabs.customItems'),
                            href: `${base}/custom-items/favourites`,
                        },
                    ]}
                />
            )}

            {!authChecked || (user && !loaded) ? (
                <DatabaseSkeleton />
            ) : !user ? (
                <div className={styles.muted}>
                    <p>
                        <TranslatableText identifier="database.favLogin" />
                    </p>
                    <a
                        className={styles.loginBtn}
                        href={`/api/auth/discord/login?next=${encodeURIComponent('/builds/favourites')}`}
                    >
                        <TranslatableText identifier="auth.loginWithDiscord" />
                    </a>
                </div>
            ) : error ? (
                <p className={styles.error}>
                    <TranslatableText identifier="database.loadError" />
                </p>
            ) : builds.length === 0 && !searchName.trim() ? (
                <p className={styles.muted}>
                    <TranslatableText identifier="database.favEmpty" />
                </p>
            ) : (
                <>
                    <input
                        type="text"
                        className={styles.searchName}
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder={t('database.filters.search')}
                        aria-label={t('database.favSearch')}
                    />
                    <div className={sf.filterActions}>
                        <input
                            type="button"
                            className={sf.submitButton}
                            value={t('common.search')}
                            onClick={searchNow}
                        />
                        <input
                            type="button"
                            className={sf.warningButton}
                            value={t('common.reset')}
                            onClick={resetSearch}
                            aria-label={t('database.favResetSearch')}
                        />
                    </div>
                    {builds.length === 0 ? (
                        <p className={styles.muted}>
                            <TranslatableText identifier="database.empty" />
                        </p>
                    ) : (
                        <InfiniteScroll
                            className={styles.grid}
                            hasMore={hasMore}
                            next={() => loadPage(pageRef.current + 1, false)}
                            loader={
                                <p className={styles.muted}>
                                    <TranslatableText identifier="database.end" />
                                </p>
                            }
                        >
                            {builds.map((build) => (
                                <BuildCard
                                    key={build.id}
                                    build={build}
                                    user={user}
                                    base={base}
                                    onToggleFavourite={(id) => toggleFavourite(id)}
                                />
                            ))}
                        </InfiniteScroll>
                    )}
                </>
            )}
        </div>
    );
}
