'use client';

import React from 'react';

const STORAGE_KEY = 'lowResource';

const LowResourceContext = React.createContext({ lowRes: false, toggle: () => {} });

export function LowResourceProvider({ children }) {
    const [lowRes, setLowRes] = React.useState(false);
    const applyClass = React.useCallback((value) => {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('low-res', value);
        }
    }, []);
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) === 'true';
            setLowRes(stored);
            applyClass(stored);
        } catch (e) {}
    }, [applyClass]);
    const toggle = React.useCallback(() => {
        setLowRes((l) => {
            const next = !l;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {}
            applyClass(next);
            return next;
        });
    }, [applyClass]);
    return <LowResourceContext.Provider value={{ lowRes, toggle }}>{children}</LowResourceContext.Provider>;
}

export function useLowResource() {
    return React.useContext(LowResourceContext);
}
