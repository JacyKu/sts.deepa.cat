'use client';

import React from 'react';

const STORAGE_KEY = 'hideObtainment';

const HideObtainmentContext = React.createContext({ hidden: false, toggle: () => {} });

export function HideObtainmentProvider({ children }) {
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
    const value = React.useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
    return <HideObtainmentContext.Provider value={value}>{children}</HideObtainmentContext.Provider>;
}

export function useHideObtainment() {
    return React.useContext(HideObtainmentContext);
}
