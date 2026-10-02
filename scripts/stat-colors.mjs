// Stat color extraction from the Monumenta item API.
//
// The /itemswithnbt endpoint embeds each item's in-game NBT as an SNBT string.
// Its display lore contains JSON text components that carry the exact color of
// every stat line, e.g.
//   {"color":"#4AC2E5","text":"+25% Spiritual Combos Damage"}
//   {"color":"dark_green","text":" 4 Attack Damage"}
// The plain /items endpoint (and the U5B fallback) has no colors, so colors are
// extracted here and attached to items.json as a per-item `statColors` map
// (stat key -> "#RRGGBB"). Rendering falls back to the site's convention-based
// palette when a stat has no color (custom items, fallback dumps).

export const COLOR_HEX = {
    black: '#000000',
    dark_blue: '#0000AA',
    dark_green: '#00AA00',
    dark_aqua: '#00AAAA',
    dark_red: '#AA0000',
    dark_purple: '#AA00AA',
    gold: '#FFAA00',
    gray: '#AAAAAA',
    dark_gray: '#555555',
    blue: '#5555FF',
    green: '#55FF55',
    aqua: '#55FFFF',
    red: '#FF5555',
    light_purple: '#FF55FF',
    yellow: '#FFFF55',
    white: '#FFFFFF',
};

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

const COMPONENT_RE = /\{"[^{}]*?"color":"([a-z_]+|#[0-9a-fA-F]{6})"[^{}]*?"text":"((?:[^"\\]|\\.)*)"[^{}]*?\}/g;

export function normalizeStatText(text) {
    let t = String(text || '').trim();
    // Removed/"negative marker" lines are written as "# -40% Blizzard Range".
    t = t.replace(/^#+\s*/, '');
    t = t.replace(/^[+-]?\d+(\.\d+)?%?\s*/, ''); // leading "+15% " / " 4 "
    t = t.toLowerCase().replace(/['-]/g, '').replace(/\s+/g, '_');
    t = t.replace(/[^a-z0-9_]/g, '');
    return t.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function stripRoman(normalized) {
    const idx = normalized.lastIndexOf('_');
    if (idx === -1) return [normalized, null];
    const tail = normalized.slice(idx + 1);
    if (ROMAN[tail]) return [normalized.slice(0, idx), ROMAN[tail]];
    return [normalized, null];
}

// Candidate keys a lore line may refer to, best first: suffix preference based
// on how the value is written ("+15% Speed" -> speed_percent, " 4 Speed" ->
// speed_base/speed_flat, " +4 Speed" -> speed_flat). Keys are normalized the
// same way as the lore text (apostrophes/hyphens dropped), so stats named
// after skills ("Sage's Insight ...") match their snake_case keys.
function candidatesFor(statKeys, text) {
    const normalized = normalizeStatText(text);
    const [stripped] = stripRoman(normalized);
    const hasPercent = /%/.test(text);
    const plus = /^\s*\+/.test(text);
    const bare = /^\s*\d/.test(text); // base stats start with a space + number

    const exact = [];
    const base = [];
    for (const key of statKeys) {
        const normKey = normalizeStatText(key);
        const baseKey = normKey.replace(/_(percent|flat|base)$/, '');
        if (normKey === normalized || normKey === stripped) exact.push(key);
        else if (baseKey === normalized || baseKey === stripped) base.push(key);
    }
    const rank = (key) => {
        const suffix = key.endsWith('_percent')
            ? 'percent'
            : key.endsWith('_base')
              ? 'base'
              : key.endsWith('_flat')
                ? 'flat'
                : 'none';
        if (suffix === 'percent') return hasPercent ? 0 : 3;
        if (suffix === 'base') return bare && !hasPercent && !plus ? 0 : 3;
        if (suffix === 'flat') return !hasPercent && (plus || bare) ? 1 : 3;
        return 0;
    };
    const all = [...new Set([...exact, ...base])];
    all.sort((a, b) => rank(a) - rank(b));
    return all;
}

// Walk every display Lore array in the NBT. The API embeds the lore twice: a
// plain copy (strings without colors) and the real NBT copy whose JSON text
// components carry the exact line colors. The parser handles both SNBT quoting
// styles and emits one entry per component - outer first, then nested "extra"
// spans - so callers can match by text (stats, locations) or by position
// (consumable effects).
function collectComponents(component, out, nested = false) {
    if (!component || typeof component !== 'object') return;
    let text = typeof component.text === 'string' ? component.text : '';
    const extras = Array.isArray(component.extra) ? component.extra : [];
    for (const extra of extras) {
        if (typeof extra === 'string') text += extra;
    }
    if (component.color || text) out.push({ color: component.color || null, text, nested });
    for (const extra of extras) {
        if (extra && typeof extra === 'object') collectComponents(extra, out, true);
    }
}

function parseLoreComponents(nbt) {
    const out = [];
    if (!nbt) return out;
    let search = 0;
    while (true) {
        const loreIdx = nbt.indexOf('Lore:[', search);
        if (loreIdx === -1) break;
        let i = loreIdx + 6;
        let depth = 1;
        const entries = [];
        let entryStart = -1;
        let quote = null;
        while (i < nbt.length && depth > 0) {
            const ch = nbt[i];
            if (quote) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === quote) quote = null;
                i++;
                continue;
            }
            if (ch === "'" || ch === '"') {
                quote = ch;
                if (depth === 1 && entryStart === -1) entryStart = i + 1;
                i++;
                continue;
            }
            if (ch === '[') depth++;
            else if (ch === ']') {
                depth--;
                if (depth === 0 && entryStart !== -1) {
                    entries.push(nbt.slice(entryStart, i));
                    entryStart = -1;
                }
            } else if (ch === ',' && depth === 1 && entryStart !== -1) {
                entries.push(nbt.slice(entryStart, i - 1));
                entryStart = -1;
            }
            i++;
        }
        search = i;
        for (const rawEntry of entries) {
            const open = rawEntry.indexOf('{');
            const close = rawEntry.lastIndexOf('}');
            if (open === -1 || close === -1 || close < open) continue;
            const jsonText = rawEntry
                .slice(open, close + 1)
                .replace(/\\'/g, "'")
                .replace(/\\(.)/g, '$1');
            try {
                collectComponents(JSON.parse(jsonText), out);
            } catch (e) {
                // Plain (non-JSON) lore entries and malformed components.
            }
        }
    }
    return out;
}

function colorToHex(color) {
    if (!color) return null;
    return color.startsWith('#') ? color.toUpperCase() : COLOR_HEX[color] || null;
}

// Returns a { statKey: "#RRGGBB" } map for the stats that appear in the item's
// NBT lore with an explicit color. Unknown colors and lines that don't match a
// stat key are skipped. Lines under a "When Consumed:" heading are consumable
// effects (see extractEffectColors): they can share names with stats ("+10%
// Speed") but belong to the effect, so that section is ignored here.
export function extractStatColors(item) {
    const nbt = item && item.nbt;
    const stats = (item && item.stats) || null;
    if (!nbt || !stats) return null;
    const statKeys = Object.keys(stats);
    if (statKeys.length === 0) return null;

    const colors = {};
    let inConsumed = false;
    for (const { color, text } of parseLoreComponents(nbt)) {
        const trimmed = String(text || '')
            .trim()
            .toLowerCase();
        if (/^when consumed/.test(trimmed)) {
            inConsumed = true;
            continue;
        }
        if (/^when (in|held|worn)/.test(trimmed)) inConsumed = false;
        if (inConsumed) continue;
        const hex = colorToHex(color);
        if (!hex) continue;
        const candidates = candidatesFor(statKeys, text);
        if (candidates.length === 0) continue;
        if (!colors[candidates[0]]) colors[candidates[0]] = hex;
    }
    return Object.keys(colors).length > 0 ? colors : null;
}

// Colors of the consumable effect lines, in the same order as item.effects.
// The game renders each effect as its own lore line under "When Consumed:";
// when duplicate effects are merged into one line (or a line is missing) the
// order can't be trusted, so the fallback palette is used instead.
export function extractEffectColors(item) {
    const nbt = item && item.nbt;
    const effects = item && item.effects;
    if (!nbt || !Array.isArray(effects) || effects.length === 0) return null;
    // Only top-level lines count: an effect line's duration is a nested span
    // of the same component, not an extra line.
    const colored = parseLoreComponents(nbt).filter((entry) => !entry.nested && colorToHex(entry.color));
    const headerIdx = colored.findIndex((entry) => /^when consumed/i.test(String(entry.text || '').trim()));
    if (headerIdx === -1) return null;
    const lines = colored.slice(headerIdx + 1).filter((entry) => String(entry.text || '').trim() !== '');
    if (lines.length !== effects.length) return null;
    return lines.map((entry) => colorToHex(entry.color));
}

// Compound displays with no plain text to match: Twisted's obfuscated half and
// the Tenyears gradient. Their colors come from the same source as the rest
// (Location.java) and are pinned here.
const LOCATION_COLOR_OVERRIDES = {
    Tenyears: '#3EFBE7',
    'Twisted lxxxxxxx': '#6B0000',
};

// The API falls back to the region name when an item's location is unknown;
// those items carry no standalone location line and keep the region colors in
// Items.module.css.
export const REGION_FALLBACK_LOCATIONS = ["King's Valley", 'Celsian Isles', "Architect's Ring"];

// Exact display color of the item's location line, taken from the game's NBT
// lore like the stat colors above. Storing it per item means an API rename
// (King's Valley Overworld, Halls of Wind and Blood, ...) can never break the
// mapping again - the color travels with the text it belongs to.
export function extractLocationColor(item) {
    const nbt = item && item.nbt;
    const location = item && item.location;
    if (!nbt || !location) return null;
    for (const { color, text } of parseLoreComponents(nbt)) {
        if (text !== location) continue;
        const hex = colorToHex(color);
        if (hex) return hex;
    }
    return LOCATION_COLOR_OVERRIDES[location] || null;
}
