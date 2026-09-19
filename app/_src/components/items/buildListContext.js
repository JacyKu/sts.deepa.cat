'use client';

import React from 'react';

// "Build list" (shopping list): items picked on the items page, kept in
// localStorage, and imported into the builder on /builder. Not shareable.
// Entries are { name, type }; older plain-string entries are normalized.
const BUILD_LIST_KEY = 'sts.buildList.v1';

const BuildListContext = React.createContext(null);

function normalize(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.map((e) => (typeof e === 'string' ? { name: e, type: null } : { name: e.name, type: e.type || null }));
}

export function BuildListProvider({ children }) {
    const [items, setItems] = React.useState([]);
    // Bumped on every add (not on restore/remove) so the panel can auto-open
    // when the user picks an item.
    const [addCount, setAddCount] = React.useState(0);

    React.useEffect(() => {
        try {
            const raw = window.localStorage.getItem(BUILD_LIST_KEY);
            if (raw) setItems(normalize(JSON.parse(raw)));
        } catch (e) {}
    }, []);

    function persist(next) {
        setItems(next);
        try {
            if (next.length === 0) window.localStorage.removeItem(BUILD_LIST_KEY);
            else window.localStorage.setItem(BUILD_LIST_KEY, JSON.stringify(next));
        } catch (e) {}
    }

    const toggleItem = React.useCallback(
        (name, type) => {
            const adding = !items.some((item) => item.name === name);
            persist(adding ? [...items, { name, type: type || null }] : items.filter((item) => item.name !== name));
            if (adding) setAddCount((c) => c + 1);
        },
        [items]
    );

    const removeItem = React.useCallback(
        (name) => {
            persist(items.filter((item) => item.name !== name));
        },
        [items]
    );

    const clear = React.useCallback(() => {
        persist([]);
    }, []);

    const value = React.useMemo(() => ({ items, addCount, toggleItem, removeItem, clear }), [
        items,
        addCount,
        toggleItem,
        removeItem,
        clear,
    ]);

    return <BuildListContext.Provider value={value}>{children}</BuildListContext.Provider>;
}

export function useBuildList() {
    return React.useContext(BuildListContext);
}

export { BUILD_LIST_KEY };
