// Minecraft text-component color names -> hex, used by the item lore parser.

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

// #rgb / #rrggbb only. The value is emitted into an inline `color` style on
// item tiles, so anything else (e.g. "#000;position:fixed;...") must be
// rejected or it would inject arbitrary CSS.
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function colorToHex(color) {
    if (typeof color !== 'string') return null;
    if (HEX_COLOR_RE.test(color)) return color.toUpperCase();
    return COLOR_HEX[color] || null;
}

// Bounded map of stat name -> hex color: keeps only valid colors so stored/
// rendered stat colors can never inject CSS, whatever the caller sends.
export function sanitizeStatColors(colors) {
    if (!colors || typeof colors !== 'object') return null;
    const out = {};
    let count = 0;
    for (const [key, value] of Object.entries(colors)) {
        if (count >= 100) break;
        if (typeof key !== 'string' || key.length > 120) continue;
        const hex = colorToHex(value);
        if (hex) {
            out[key] = hex;
            count += 1;
        }
    }
    return count > 0 ? out : null;
}
