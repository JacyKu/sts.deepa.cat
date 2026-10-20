'use client';

import React from 'react';
import { isLocationIdEnabled, setLocationIdEnabled } from '../../utils/locationPrefs';

// Whether item locations render as their registry id. The Settings toggle writes
// through this context, so pages that are already mounted follow the change
// without a reload (the stored value is only read once, on mount).
const LocationIdsContext = React.createContext({ useIds: false, setUseIds: () => {} });

export function LocationIdsProvider({ children }) {
    const [useIds, setUseIdsState] = React.useState(false);
    React.useEffect(() => {
        setUseIdsState(isLocationIdEnabled());
    }, []);
    const setUseIds = React.useCallback((next) => {
        setUseIdsState(Boolean(next));
        setLocationIdEnabled(next);
    }, []);
    const value = React.useMemo(() => ({ useIds, setUseIds }), [useIds, setUseIds]);
    return <LocationIdsContext.Provider value={value}>{children}</LocationIdsContext.Provider>;
}

export function useLocationIds() {
    return React.useContext(LocationIdsContext);
}
