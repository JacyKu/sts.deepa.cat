'use client';

import React from 'react';
import { useFavouritesEnabled } from './favouritesEnabledContext';

// Item favourites for the signed-in user. Favourites are stored server-side
// (per Discord account) so they follow the user across devices; the provider
// fetches them once on mount. `toggle` flips optimistically and reverts on
// failure; when the user is not logged in, `authenticated` is false and
// callers can route them to the Discord login instead.
const ItemFavouritesContext = React.createContext({
    favourites: [],
    favouriteSet: new Set(),
    authenticated: false,
    ready: false,
    enabled: false,
    toggle: () => {},
});

export function ItemFavouritesProvider({ children }) {
    const { enabled } = useFavouritesEnabled();
    const [favourites, setFavourites] = React.useState([]);
    const [authenticated, setAuthenticated] = React.useState(false);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        // Feature off: no hearts, no fetch, no sorting.
        if (!enabled) {
            setFavourites([]);
            setAuthenticated(false);
            setReady(false);
            return;
        }
        let active = true;
        fetch('/api/v1/items/favourites')
            .then((res) => (res.ok ? res.json() : { favourites: [], authenticated: false }))
            .then((data) => {
                if (!active) return;
                setFavourites(Array.isArray(data.favourites) ? data.favourites : []);
                setAuthenticated(Boolean(data.authenticated));
                setReady(true);
            })
            .catch(() => {
                if (!active) return;
                setReady(true);
            });
        return () => {
            active = false;
        };
    }, [enabled]);

    const toggle = React.useCallback(
        (name) => {
            if (!name || !enabled) return;
            setFavourites((prev) => {
                const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
                const adding = next.includes(name);
                const url = adding
                    ? `/api/v1/items/favourite`
                    : `/api/v1/items/favourite?name=${encodeURIComponent(name)}`;
                fetch(url, {
                    method: adding ? 'POST' : 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: adding ? JSON.stringify({ name }) : undefined,
                }).then((res) => {
                    if (!res.ok) {
                        setFavourites((prev2) =>
                            prev2.includes(name) ? prev2.filter((n) => n !== name) : [...prev2, name]
                        );
                    }
                });
                return next;
            });
        },
        [enabled]
    );

    const favouriteSet = React.useMemo(() => new Set(favourites), [favourites]);

    const value = React.useMemo(
        () => ({ favourites, favouriteSet, authenticated, ready, enabled, toggle }),
        [favourites, favouriteSet, authenticated, ready, enabled, toggle]
    );

    return <ItemFavouritesContext.Provider value={value}>{children}</ItemFavouritesContext.Provider>;
}

export function useItemFavourites() {
    return React.useContext(ItemFavouritesContext);
}
