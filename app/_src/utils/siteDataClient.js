'use client';

// Client-side loaders for the big, rarely-changing data files. Pages pass the
// content version (file mtime) and the endpoints serve immutable responses,
// so the browser downloads each file once per data update instead of on every
// page load. The module-level cache also dedupes parallel requests from
// different components on the same page.
import React from 'react';

const pending = new Map();

function loadJson(url) {
    if (!pending.has(url)) {
        pending.set(
            url,
            fetch(url, { cache: 'force-cache' }).then((res) =>
                res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))
            )
        );
    }
    return pending.get(url);
}

let versions = { items: '', history: '', skills: '', cz: '' };

// The versions are known server-side; each data view passes them here during
// render so deep components (builder, search form) can version their own
// fetches before they mount.
export function setSiteDataVersions(next) {
    versions = { ...versions, ...next };
}

export function loadItemData(version) {
    return loadJson(`/api/v2/items/all?v=${encodeURIComponent(version)}`).then((data) => data.items);
}

export function loadRawItemData(version) {
    return loadJson(`/api/v2/items/raw?v=${encodeURIComponent(version)}`).then((data) => data.items);
}

export function loadItemHistory(version) {
    if (!version || version === 'none') return Promise.resolve(null);
    return loadJson(`/api/v2/items/history?v=${encodeURIComponent(version)}`).then((data) => data.history);
}

export function loadSkills() {
    return loadJson(`/api/v2/skills?v=${encodeURIComponent(versions.skills || '')}`);
}

export function loadCz() {
    return loadJson(`/api/v2/cz?v=${encodeURIComponent(versions.cz || '')}`);
}

// Loads the data a page needs and keeps the result (or the error) for the
// caller to render the page or a retry state.
export function useSiteData({ itemDataVersion, historyVersion = null, raw = false } = {}) {
    const [state, setState] = React.useState({ itemData: null, history: null, error: null });
    React.useEffect(() => {
        let active = true;
        const items = raw ? loadRawItemData(itemDataVersion) : loadItemData(itemDataVersion);
        const history = historyVersion ? loadItemHistory(historyVersion) : Promise.resolve(null);
        Promise.all([items, history])
            .then(([itemData, historyData]) => {
                if (active) setState({ itemData, history: historyData, error: null });
            })
            .catch((error) => {
                if (active) {
                    setState({
                        itemData: null,
                        history: null,
                        error: String(error && error.message ? error.message : error),
                    });
                }
            });
        return () => {
            active = false;
        };
    }, [itemDataVersion, historyVersion, raw]);
    return state;
}
