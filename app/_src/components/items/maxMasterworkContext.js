'use client';

import React from 'react';

const STORAGE_KEY = 'maxMasterworkDefault';

const MaxMasterworkContext = React.createContext({ enabled: false, toggle: () => {} });

export function MaxMasterworkProvider({ children }) {
    const [enabled, setEnabled] = React.useState(false);
    React.useEffect(() => {
        try {
            setEnabled(localStorage.getItem(STORAGE_KEY) === 'true');
        } catch (e) {}
    }, []);
    const toggle = React.useCallback(() => {
        setEnabled((e) => {
            const next = !e;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {}
            return next;
        });
    }, []);
    return (
        <MaxMasterworkContext.Provider value={{ enabled, toggle }}>{children}</MaxMasterworkContext.Provider>
    );
}

export function useMaxMasterwork() {
    return React.useContext(MaxMasterworkContext);
}
