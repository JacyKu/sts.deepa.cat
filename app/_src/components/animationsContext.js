'use client';

import React from 'react';

const STORAGE_KEY = 'animations';

// Stored as `true` when animations are ON (legacy key name kept for
// backward compatibility); the toggle exposes `hidden` so it reads like
// the other "hide" toggles ("Hide item animations").
const AnimationsContext = React.createContext({ hidden: false, toggle: () => {} });

export function AnimationsProvider({ children }) {
    const [enabled, setEnabled] = React.useState(true);
    const applyClass = React.useCallback((value) => {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('anim-off', !value);
        }
    }, []);
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) !== 'false';
            setEnabled(stored);
            applyClass(stored);
        } catch (e) {}
    }, [applyClass]);
    const toggle = React.useCallback(() => {
        setEnabled((e) => {
            const next = !e;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch (err) {}
            applyClass(next);
            return next;
        });
    }, [applyClass]);
    return <AnimationsContext.Provider value={{ hidden: !enabled, toggle }}>{children}</AnimationsContext.Provider>;
}

export function useAnimations() {
    return React.useContext(AnimationsContext);
}
