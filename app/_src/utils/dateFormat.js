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
// which `spaceToT` preserves. `utc` keeps the display in UTC (for times that
// must read the same for every visitor) and `includeTime` appends HH:MM.
export function formatDateString(raw, { spaceToT = false, includeTime = false, utc = false } = {}) {
    let text = String(raw == null ? '' : raw).trim();
    if (!text) return '';
    const value = spaceToT ? text.replace(' ', 'T') : text;
    // Stored timestamps usually have no timezone; only append the Z when the
    // string does not already carry one (ISO strings from the API end in Z).
    const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + 'Z');
    if (Number.isNaN(d.getTime())) return '';
    const zone = utc ? { timeZone: 'UTC' } : undefined;
    const dateText = isAmericanDateEnabled()
        ? d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', ...zone })
        : d.toLocaleDateString(undefined, zone);
    if (!includeTime) return dateText;
    const timeText = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
    return `${dateText} ${timeText}`;
}
