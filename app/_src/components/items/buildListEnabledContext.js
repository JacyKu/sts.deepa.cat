'use client';

import React from 'react';

// Master switch for the build list ("shopping list") feature. When off, no
// add buttons, no panel, and the builder never auto-imports.
const STORAGE_KEY = 'buildListEnabled';

const BuildListEnabledContext = React.createContext({ enabled: false, toggle: () => {} });

export function BuildListEnabledProvider({ children }) {
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
    return <BuildListEnabledContext.Provider value={{ enabled, toggle }}>{children}</BuildListEnabledContext.Provider>;
}

export function useBuildListEnabled() {
    return React.useContext(BuildListEnabledContext);
}
