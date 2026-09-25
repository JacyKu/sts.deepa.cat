// Date display preference. Empty (the default) uses the browser's locale
// formatting (what every card showed before this setting); 'us' renders
// MM/DD/YYYY and 'iso' renders YYYY/MM/DD, regardless of locale.
export const DATE_FORMAT_KEY = 'sts.dateFormat';
export const DATE_FORMATS = ['us', 'iso'];

// The setting started as a boolean "American date format" toggle.
const LEGACY_AMERICAN_KEY = 'sts.americanDate';

export function getDateFormat() {
    if (typeof window === 'undefined') return '';
    try {
        const stored = window.localStorage.getItem(DATE_FORMAT_KEY);
        if (DATE_FORMATS.includes(stored)) return stored;
        if (window.localStorage.getItem(LEGACY_AMERICAN_KEY) === '1') return 'us';
    } catch (e) {
        return '';
    }
    return '';
}

export function setDateFormat(format) {
    try {
        if (DATE_FORMATS.includes(format)) window.localStorage.setItem(DATE_FORMAT_KEY, format);
        else window.localStorage.removeItem(DATE_FORMAT_KEY);
        window.localStorage.removeItem(LEGACY_AMERICAN_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}

// Month + year heading (e.g. "September 2026") for the dated changelog
// groups in the API changes page. Always UTC so the heading matches the run
// timestamps shown under it.
export function formatMonthString(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return '';
    const d = new Date(text.slice(0, 7) + '-01T00:00:00Z');
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// The date part in the chosen format; '' (the default) follows the locale.
function formatDatePart(d, utc, zone) {
    const format = getDateFormat();
    if (format === 'us') {
        return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', ...zone });
    }
    if (format === 'iso') {
        const pad = (n) => String(n).padStart(2, '0');
        const year = utc ? d.getUTCFullYear() : d.getFullYear();
        const month = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
        const day = utc ? d.getUTCDate() : d.getDate();
        return `${year}/${pad(month)}/${pad(day)}`;
    }
    return d.toLocaleDateString(undefined, zone);
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
    const dateText = formatDatePart(d, utc, zone);
    if (!includeTime) return dateText;
    const timeText = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
    return `${dateText} ${timeText}`;
}
