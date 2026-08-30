'use client';

import React from 'react';

// Build card layout preference: show the equipped items strip on the card
// face and move the skill chips into the hover panel (default is the
// opposite - skills on the card, items on hover).
const STORAGE_KEY = 'cardItemsFirst';

const CardItemsFirstContext = React.createContext({ itemsFirst: false, toggle: () => {} });

export function CardItemsFirstProvider({ children }) {
    const [itemsFirst, setItemsFirst] = React.useState(false);
    React.useEffect(() => {
        try {
            setItemsFirst(localStorage.getItem(STORAGE_KEY) === 'true');
        } catch (e) {}
    }, []);
    const toggle = React.useCallback(() => {
        setItemsFirst((itemsFirst) => {
            const next = !itemsFirst;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (e) {}
            return next;
        });
    }, []);
    return <CardItemsFirstContext.Provider value={{ itemsFirst, toggle }}>{children}</CardItemsFirstContext.Provider>;
}

export function useCardItemsFirst() {
    return React.useContext(CardItemsFirstContext);
}
