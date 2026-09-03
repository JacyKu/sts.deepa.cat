'use client';

import React from 'react';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import InfiniteScroll from './infiniteScroll';
import styles from '../styles/Database.module.css';
import DatabaseSkeleton from './databaseSkeleton';
import { getStsBase } from '../utils/base';

export default function FavouritesPage() {
    const [base, setBase] = React.useState('/sts');
    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [builds, setBuilds] = React.useState([]);
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
    const loadSeq = React.useRef(0);

    function loadPage(nextPage, replace) {
        if (loadingRef.current && !replace) return;
        loadingRef.current = true;
        const seq = ++loadSeq.current;
        fetch(`/api/v1/builds/favourites?page=${nextPage}&limit=24`)
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

    function toggleFavourite(buildId) {
        setBuilds((prev) => prev.filter((b) => b.id !== buildId));
    }

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>
                <TranslatableText identifier="database.favTitle" />
            </h1>

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
            ) : builds.length === 0 ? (
                <p className={styles.muted}>
                    <TranslatableText identifier="database.favEmpty" />
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
        </div>
    );
}
