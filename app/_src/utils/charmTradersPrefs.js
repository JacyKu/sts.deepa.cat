// Whether basic charms show the NPC that sells them and their coordinates.
// On by default; stored per browser like the other site settings.
const CHARM_TRADERS_FLAG_KEY = 'sts.showCharmTraders';

export function isCharmTradersEnabled() {
    if (typeof window === 'undefined') return true;
    try {
        const stored = window.localStorage.getItem(CHARM_TRADERS_FLAG_KEY);
        return stored === null ? true : stored === 'true';
    } catch (e) {
        return true;
    }
}

export function setCharmTradersEnabled(enabled) {
    try {
        window.localStorage.setItem(CHARM_TRADERS_FLAG_KEY, String(Boolean(enabled)));
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
