// User-facing caching settings (Settings menu). The site may keep your last
// search, your builder state and your custom items in localStorage only while
// the matching toggle is on. All default to ON (current behaviour); turning
// one off stops both the saving and the restoring, and clears whatever was
// already stored.
const SEARCH_FLAG_KEY = 'sts.cacheSearch';
const BUILDS_FLAG_KEY = 'sts.cacheBuilds';
const CUSTOM_ITEMS_FLAG_KEY = 'sts.cacheCustomItems';

export const SEARCH_CACHE_DATA_KEY = 'sts.itemsSearch.v1';
export const DRAFT_DATA_KEY = 'sts.buildDraft.v1';
export const ORDER_PREFIX = 'sts.order.';
export const CUSTOM_ITEMS_CACHE_KEY = 'sts.customItems.v1';
export const CUSTOM_ITEMS_DRAFT_KEY = 'sts.customItemsDraft.v1';

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
export const isCustomItemsCacheEnabled = () => getFlag(CUSTOM_ITEMS_FLAG_KEY);

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

export function setCustomItemsCacheEnabled(enabled) {
    try {
        window.localStorage.setItem(CUSTOM_ITEMS_FLAG_KEY, String(enabled));
        if (!enabled) window.localStorage.removeItem(CUSTOM_ITEMS_CACHE_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
