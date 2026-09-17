'use client';

import React from 'react';

// Item change history visibility preference (settings page): show the
// per-item stat change history inside the item tiles on the items page.
// Shown by default; stored per browser like the other site toggles.
const STORAGE_KEY = 'showItemHistory';

const ItemHistoryContext = React.createContext({ enabled: true, setEnabled: () => {} });

export function ItemHistoryProvider({ children }) {
    const [enabled, setEnabled] = React.useState(true);
    React.useEffect(() => {
        try {
            setEnabled(localStorage.getItem(STORAGE_KEY) !== 'false');
        } catch (e) {}
    }, []);
    const update = React.useCallback((next) => {
        setEnabled(next);
        try {
            localStorage.setItem(STORAGE_KEY, String(next));
        } catch (e) {}
    }, []);
    const value = React.useMemo(() => ({ enabled, setEnabled: update }), [enabled, update]);
    return <ItemHistoryContext.Provider value={value}>{children}</ItemHistoryContext.Provider>;
}

export function useItemHistory() {
    return React.useContext(ItemHistoryContext);
}
