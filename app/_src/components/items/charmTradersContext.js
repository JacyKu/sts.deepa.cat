'use client';

import React from 'react';
import { isCharmTradersEnabled, setCharmTradersEnabled } from '../../utils/charmTradersPrefs';

// Whether charm tiles show the NPC that sells the basic charm, with their
// coordinates. On by default; the Settings toggle writes through this context,
// so item tiles already on screen follow the change without a reload (the
// stored value is only read once, on mount).
const CharmTradersContext = React.createContext({ show: true, setShow: () => {} });

export function CharmTradersProvider({ children }) {
    const [show, setShowState] = React.useState(true);
    React.useEffect(() => {
        setShowState(isCharmTradersEnabled());
    }, []);
    const setShow = React.useCallback((next) => {
        setShowState(Boolean(next));
        setCharmTradersEnabled(next);
    }, []);
    const value = React.useMemo(() => ({ show, setShow }), [show, setShow]);
    return <CharmTradersContext.Provider value={value}>{children}</CharmTradersContext.Provider>;
}

export function useCharmTraders() {
    return React.useContext(CharmTradersContext);
}
