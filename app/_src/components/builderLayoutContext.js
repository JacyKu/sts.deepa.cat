'use client';

import React from 'react';

// Experimental "New Layout" for the builder: the equipment slot inputs go in
// a column on the left (rows of two: mainhand/offhand, then helmet/
// chestplate, leggings/boots) with the stats on the right. Off by default;
// mobile always keeps the standard layout regardless of this setting.
const STORAGE_KEY = 'sts.builderNewLayout';

const BuilderLayoutContext = React.createContext({ newLayout: false, toggle: () => {} });

export function BuilderLayoutProvider({ children }) {
    const [newLayout, setNewLayout] = React.useState(false);
    React.useEffect(() => {
        try {
            setNewLayout(localStorage.getItem(STORAGE_KEY) === 'true');
        } catch (e) {
            // storage unavailable; keep the default
        }
    }, []);
    const toggle = React.useCallback(() => {
        setNewLayout((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {
                // storage unavailable; keep in-memory state only
            }
            return next;
        });
    }, []);
    return <BuilderLayoutContext.Provider value={{ newLayout, toggle }}>{children}</BuilderLayoutContext.Provider>;
}

export function useBuilderLayout() {
    return React.useContext(BuilderLayoutContext);
}
