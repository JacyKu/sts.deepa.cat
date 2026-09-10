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
// speed_base/speed_flat, " +4 Speed" -> speed_flat).
function candidatesFor(statKeys, text) {
    const normalized = normalizeStatText(text);
    const [stripped] = stripRoman(normalized);
    const hasPercent = /%/.test(text);
    const plus = /^\s*\+/.test(text);
    const bare = /^\s*\d/.test(text); // base stats start with a space + number

    const exact = [];
    const base = [];
    for (const key of statKeys) {
        const baseKey = key.replace(/_(percent|flat|base)$/, '');
        if (key === normalized || key === stripped) exact.push(key);
        else if (baseKey === normalized || baseKey === stripped) base.push(key);
    }
    const rank = (key) => {
        const suffix = key.endsWith('_percent') ? 'percent' : key.endsWith('_base') ? 'base' : key.endsWith('_flat') ? 'flat' : 'none';
        if (suffix === 'percent') return hasPercent ? 0 : 3;
        if (suffix === 'base') return bare && !hasPercent && !plus ? 0 : 3;
        if (suffix === 'flat') return !hasPercent && (plus || bare) ? 1 : 3;
        return 0;
    };
    const all = [...new Set([...exact, ...base])];
    all.sort((a, b) => rank(a) - rank(b));
    return all;
}

function parseComponents(nbt) {
    const out = [];
    COMPONENT_RE.lastIndex = 0;
    let m;
    while ((m = COMPONENT_RE.exec(nbt))) {
        // SNBT single-quoted strings escape apostrophes as \' etc.
        const text = m[2].replace(/\\(.)/g, '$1');
        out.push({ color: m[1], text });
    }
    return out;
}

// Returns a { statKey: "#RRGGBB" } map for the stats that appear in the item's
// NBT lore with an explicit color. Unknown colors and lines that don't match a
// stat key are skipped.
export function extractStatColors(item) {
    const nbt = item && item.nbt;
    const stats = (item && item.stats) || null;
    if (!nbt || !stats) return null;
    const statKeys = Object.keys(stats);
    if (statKeys.length === 0) return null;

    const colors = {};
    for (const { color, text } of parseComponents(nbt)) {
        const hex = color.startsWith('#') ? color.toUpperCase() : COLOR_HEX[color];
        if (!hex) continue;
        const candidates = candidatesFor(statKeys, text);
        if (candidates.length === 0) continue;
        if (!colors[candidates[0]]) colors[candidates[0]] = hex;
    }
    return Object.keys(colors).length > 0 ? colors : null;
}
