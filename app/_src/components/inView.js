'use client';

import React from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

// One IntersectionObserver per rootMargin, shared by every useInView caller
// (hundreds of cards on the builds page) instead of one observer each, with a
// per-element callback registry the single observer dispatches into.
const observers = new Map();

function getObserver(margin) {
    let entry = observers.get(margin);
    if (!entry) {
        const callbacks = new WeakMap();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const callback = callbacks.get(entry.target);
                    if (callback) callback(entry);
                }
            },
            { rootMargin: `${margin}px` }
        );
        entry = { observer, callbacks };
        observers.set(margin, entry);
    }
    return entry;
}

export function useInView(externalRef, { margin = 600 } = {}) {
    const ownRef = React.useRef(null);
    const ref = externalRef || ownRef;
    const [inView, setInView] = React.useState(true);
    const [minHeight, setMinHeight] = React.useState(0);

    useIsomorphicLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;

        const rect = el.getBoundingClientRect();
        if (rect.bottom < -margin || rect.top > window.innerHeight + margin) {
            setMinHeight(rect.height);
            setInView(false);
        }

        const { observer, callbacks } = getObserver(margin);
        callbacks.set(el, (entry) => {
            if (entry.isIntersecting) {
                setMinHeight(0);
                setInView(true);
            } else {
                setMinHeight((height) => height || entry.boundingClientRect.height);
                setInView(false);
            }
        });
        observer.observe(el);
        return () => {
            callbacks.delete(el);
            observer.unobserve(el);
        };
    }, [ref, margin]);

    // Stable identity so a consumer keyed on the returned object (or passing it
    // down) does not see a new object on every parent render.
    return React.useMemo(() => ({ ref, inView, minHeight }), [ref, inView, minHeight]);
}
