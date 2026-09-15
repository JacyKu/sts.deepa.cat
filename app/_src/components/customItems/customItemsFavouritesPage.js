'use client';

// The signed-in user's liked custom items, with the same two switchers as the
// builds favourites page: My Builds / My Favourites / My Items, and the
// Builds / Custom items section tabs (shown to logged-in users only).
import React from 'react';
import styles from '../../styles/CustomItems.module.css';
import dbStyles from '../../styles/Database.module.css';
import sf from '../../styles/SearchForm.module.css';
import InfiniteScroll from '../infiniteScroll';
import DatabaseTabs from '../databaseTabs';
import { MyPagesTabs } from '../databaseTabs';
import CustomItemCard from './customItemCard';
import CustomItemHeart from './customItemHeart';
import { CustomItemCardSkeleton } from './customItemsSkeleton';
import { getStsBase } from '../../utils/base';

export default function CustomItemsFavouritesPage() {
    const [base, setBase] = React.useState('/sts');
    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [items, setItems] = React.useState([]);
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
        fetch(`/api/v1/custom-items/favourites?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                if (seq !== loadSeq.current) return;
                setItems((prev) => (replace ? d.items : [...prev, ...d.items]));
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

    // Unlike from the list: the card heart updates itself; drop the card once
    // it is no longer a favourite.
    function handleToggle(itemId, state) {
        if (!state.favourite) {
            setItems((prev) => prev.filter((item) => item.id !== itemId));
        }
    }

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>My Favourites</h1>
                <MyPagesTabs active="favourites" className={styles.myTabs} />
                {user && (
                    <DatabaseTabs
                        active="custom-items"
                        className={styles.favTabs}
                        tabs={[
                            { key: 'builds', label: 'Builds', href: `${base}/builds/favourites` },
                            { key: 'custom-items', label: 'Custom items', href: `${base}/custom-items/favourites` },
                        ]}
                    />
                )}

                {!authChecked || (user && !loaded) ? (
                    <div className={styles.itemGrid}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <CustomItemCardSkeleton key={i} pencil={false} actions={false} />
                        ))}
                    </div>
                ) : !user ? (
                    <div className={styles.favNote}>
                        <p>Log in with Discord to see your favourite custom items.</p>
                        <a
                            className={styles.loginBtn}
                            href={`/api/auth/discord/login?next=${encodeURIComponent('/custom-items/favourites')}`}
                        >
                            Log in with Discord
                        </a>
                    </div>
                ) : error ? (
                    <p className={`${styles.errorText} ${styles.favNote}`}>Failed to load your favourite items.</p>
                ) : items.length === 0 && !searchName.trim() ? (
                    <p className={`${styles.muted} ${styles.favNote}`}>
                        No favourite custom items yet. Tap the heart on an item to save it here.
                    </p>
                ) : (
                    <>
                        <input
                            type="text"
                            className={dbStyles.searchName}
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder="Search by item name"
                            aria-label="Search favourite custom items by name"
                        />
                        <div className={sf.filterActions}>
                            <input type="button" className={sf.submitButton} value="Search" onClick={searchNow} />
                            <input
                                type="button"
                                className={sf.warningButton}
                                value="Reset"
                                onClick={resetSearch}
                                aria-label="Reset search"
                            />
                        </div>
                        {items.length === 0 ? (
                            <p className={`${styles.muted} ${styles.favNote}`}>No favourite items match your search.</p>
                        ) : (
                            <InfiniteScroll
                                className={styles.itemGrid}
                                hasMore={hasMore}
                                next={() => loadPage(pageRef.current + 1, false)}
                                loader={<p className={styles.muted}>End of your favourite items.</p>}
                            >
                                {items.map((item) => (
                                    <CustomItemCard
                                        key={item.id}
                                        item={item}
                                        href={`${base}/custom-items/${item.id}`}
                                        authorFallback="a player"
                                        heart={
                                            <CustomItemHeart
                                                itemId={item.id}
                                                favourite={item.myFavourite}
                                                count={item.favouriteCount}
                                                user={user}
                                                onChange={(state) => handleToggle(item.id, state)}
                                            />
                                        }
                                    />
                                ))}
                            </InfiniteScroll>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
