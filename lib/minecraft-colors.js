// Minecraft text-component color names -> hex, shared by the item lore parser
// and the spritesheet stat-color extractor.

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

export function colorToHex(color) {
    if (!color) return null;
    if (color.startsWith('#')) return color.toUpperCase();
    return COLOR_HEX[color] || null;
}
