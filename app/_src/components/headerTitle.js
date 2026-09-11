'use client';

import React from 'react';
import SiteNav from '@deepa/shared/site-nav';

// Browser-local header title override set in Settings. The shared SiteNav
// keeps its default brand; this wrapper swaps in the stored name when one is
// set (and reacts to changes from the Settings page or other tabs).
export const HEADER_TITLE_MAX = 15;
export const HEADER_TITLE_KEY = 'headerTitle';
export const HEADER_TITLE_EVENT = 'sts-header-title';

export function readHeaderTitle(fallback) {
    try {
        const stored = window.localStorage.getItem(HEADER_TITLE_KEY);
        const clean = stored ? stored.trim().slice(0, HEADER_TITLE_MAX) : '';
        return clean || fallback;
    } catch (e) {
        return fallback;
    }
}

export function saveHeaderTitle(value) {
    const clean = String(value || '').slice(0, HEADER_TITLE_MAX);
    try {
        if (clean.trim()) window.localStorage.setItem(HEADER_TITLE_KEY, clean);
        else window.localStorage.removeItem(HEADER_TITLE_KEY);
    } catch (e) {
        // ignore storage failures
    }
    window.dispatchEvent(new Event(HEADER_TITLE_EVENT));
}

export default function HeaderSiteNav({ brand, children, ...props }) {
    const [title, setTitle] = React.useState(brand);

    React.useEffect(() => {
        const update = () => setTitle(readHeaderTitle(brand));
        update();
        window.addEventListener(HEADER_TITLE_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(HEADER_TITLE_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, [brand]);

    return (
        <SiteNav brand={title} {...props}>
            {children}
        </SiteNav>
    );
}
