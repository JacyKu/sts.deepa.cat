// Whether item locations are shown as their registry id ("lime") instead of the
// in-game name ("Salazar's Folly"). Off by default; stored per browser like the
// other site settings.
const LOCATION_IDS_FLAG_KEY = 'sts.locationIds';

export function isLocationIdEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(LOCATION_IDS_FLAG_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

export function setLocationIdEnabled(enabled) {
    try {
        window.localStorage.setItem(LOCATION_IDS_FLAG_KEY, String(Boolean(enabled)));
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
