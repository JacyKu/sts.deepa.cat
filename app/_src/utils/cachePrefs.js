// User-facing caching settings (Settings menu). The site may keep your last
// search and your builder state in localStorage only while its toggle is on.
// Both default to ON (current behaviour); turning one off stops both the
// saving and the restoring, and clears whatever was already stored.
const SEARCH_FLAG_KEY = 'sts.cacheSearch';
const BUILDS_FLAG_KEY = 'sts.cacheBuilds';

export const SEARCH_CACHE_DATA_KEY = 'sts.itemsSearch.v1';
export const DRAFT_DATA_KEY = 'sts.buildDraft.v1';
export const ORDER_PREFIX = 'sts.order.';

function getFlag(key) {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(key) !== 'false';
    } catch (e) {
        return true;
    }
}

export const isSearchCacheEnabled = () => getFlag(SEARCH_FLAG_KEY);
export const isBuildsCacheEnabled = () => getFlag(BUILDS_FLAG_KEY);

export function setSearchCacheEnabled(enabled) {
    try {
        window.localStorage.setItem(SEARCH_FLAG_KEY, String(enabled));
        if (!enabled) window.localStorage.removeItem(SEARCH_CACHE_DATA_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}

export function setBuildsCacheEnabled(enabled) {
    try {
        window.localStorage.setItem(BUILDS_FLAG_KEY, String(enabled));
        if (!enabled) {
            window.localStorage.removeItem(DRAFT_DATA_KEY);
            for (const key of Object.keys(window.localStorage)) {
                if (key.startsWith(ORDER_PREFIX)) window.localStorage.removeItem(key);
            }
        }
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
