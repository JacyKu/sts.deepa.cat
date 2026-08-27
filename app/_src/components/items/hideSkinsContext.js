'use client';

import React from 'react';

const STORAGE_KEY = 'hideSkins';

const HideSkinsContext = React.createContext({ hidden: false, toggle: () => {} });

export function HideSkinsProvider({ children }) {
    const [hidden, setHidden] = React.useState(false);
    React.useEffect(() => {
        try {
            setHidden(localStorage.getItem(STORAGE_KEY) === 'true');
        } catch (e) {}
    }, []);
    const toggle = React.useCallback(() => {
        setHidden((h) => {
            const next = !h;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {}
            return next;
        });
    }, []);
    return <HideSkinsContext.Provider value={{ hidden, toggle }}>{children}</HideSkinsContext.Provider>;
}

export function useHideSkins() {
    return React.useContext(HideSkinsContext);
}
