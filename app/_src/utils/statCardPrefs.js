// Which builder stat cards are hidden, per browser. Every card is shown by
// default; the toggle row above the cards hides/shows them.
export const HIDDEN_STAT_CARDS_KEY = 'sts.hiddenStatCards';

// Same keys (and defaults) as the builder's STAT_CARD_KEYS.
const KNOWN_STAT_CARDS = ['misc', 'health', 'dr', 'drhn', 'ehp', 'ehpr', 'melee', 'projectile', 'magic'];

export function getHiddenStatCards() {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_STAT_CARDS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((key) => KNOWN_STAT_CARDS.includes(key)) : [];
    } catch (e) {
        return [];
    }
}

export function setHiddenStatCards(keys) {
    try {
        const clean = (Array.isArray(keys) ? keys : []).filter((key) => KNOWN_STAT_CARDS.includes(key));
        if (clean.length === 0) window.localStorage.removeItem(HIDDEN_STAT_CARDS_KEY);
        else window.localStorage.setItem(HIDDEN_STAT_CARDS_KEY, JSON.stringify(clean));
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
