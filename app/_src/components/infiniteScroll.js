'use client';

import React from 'react';

// Replacement for react-infinite-scroll-component:
// loads more items when the user scrolls near the bottom of the container.
//
// A scroll/resize listener plus a light poll (500ms) so the trigger works
// regardless of which element actually scrolls. The check only fires when the
// container bottom is within ~300px of the viewport bottom, and each fire
// grows the content (the parents' `next` always adds items), so it terminates
// as soon as the container extends past that margin — re-renders alone (e.g.
// filter toggles) can never loop it.
export default function InfiniteScroll({ className, children, next, hasMore = true, loader }) {
    const containerRef = React.useRef(null);
    // Keep the latest callback in a ref so the effect only depends on hasMore.
    const nextRef = React.useRef(next);
    nextRef.current = next;

    React.useEffect(() => {
        if (!hasMore) return;
        const el = containerRef.current;
        if (!el) return;

        const check = () => {
            const rect = el.getBoundingClientRect();
            if (rect.bottom <= window.innerHeight + 300) {
                nextRef.current();
            }
        };

        // Fill the initial viewport without requiring a scroll first.
        check();
        window.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check, { passive: true });
        const interval = setInterval(check, 500);
        return () => {
            window.removeEventListener('scroll', check);
            window.removeEventListener('resize', check);
            clearInterval(interval);
        };
    }, [hasMore]);

    return (
        <div className={className} ref={containerRef}>
            {children}
            {hasMore ? null : loader}
        </div>
    );
}
