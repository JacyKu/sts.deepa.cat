// Date display preference. Off by default: dates use the browser's locale
// formatting (what every card currently shows). When on, dates render in the
// American MM/DD/YYYY layout regardless of locale.
export const AMERICAN_DATE_KEY = 'sts.americanDate';

export function isAmericanDateEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(AMERICAN_DATE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

export function setAmericanDateEnabled(enabled) {
    try {
        if (enabled) window.localStorage.setItem(AMERICAN_DATE_KEY, '1');
        else window.localStorage.removeItem(AMERICAN_DATE_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}

// Formats one of the site's stored timestamps (SQLite "YYYY-MM-DD HH:MM:SS"
// or ISO-ish strings, always treated as UTC) as a short date. Existing call
// sites differ in whether they convert the space to a "T" before parsing,
// which `spaceToT` preserves.
export function formatDateString(raw, { spaceToT = false } = {}) {
    let text = String(raw == null ? '' : raw).trim();
    if (!text) return '';
    const d = new Date((spaceToT ? text.replace(' ', 'T') : text) + 'Z');
    if (Number.isNaN(d.getTime())) return '';
    return isAmericanDateEnabled()
        ? d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : d.toLocaleDateString();
}
