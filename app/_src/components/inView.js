'use client';

import React from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

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

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                if (entry.isIntersecting) {
                    setMinHeight(0);
                    setInView(true);
                } else {
                    setMinHeight((height) => height || entry.boundingClientRect.height);
                    setInView(false);
                }
            },
            { rootMargin: `${margin}px` }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, margin]);

    return { ref, inView, minHeight };
}
