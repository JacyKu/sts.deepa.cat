'use client';

import React from 'react';

// Master switch for the item favourites feature. When off (the default), no
// favourite hearts are shown, favourites are not fetched, and the builder
// does not sort favourited items first.
const STORAGE_KEY = 'favouritesEnabled';

const FavouritesEnabledContext = React.createContext({ enabled: false, toggle: () => {} });

export function FavouritesEnabledProvider({ children }) {
    const [enabled, setEnabled] = React.useState(false);
    React.useEffect(() => {
        try {
            setEnabled(localStorage.getItem(STORAGE_KEY) === 'true');
        } catch (e) {}
    }, []);
    const toggle = React.useCallback(() => {
        setEnabled((enabled) => {
            const next = !enabled;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {}
            return next;
        });
    }, []);
    return (
        <FavouritesEnabledContext.Provider value={{ enabled, toggle }}>{children}</FavouritesEnabledContext.Provider>
    );
}

export function useFavouritesEnabled() {
    return React.useContext(FavouritesEnabledContext);
}
