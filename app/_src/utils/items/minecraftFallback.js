// Maps a base item to its texture key on the vanilla Minecraft fallback sheet
// (minecraft.webp / _minecraft.css). Most base items use their own texture
// (lowercased, underscores -> dashes); a few use a shared or block texture.
const BASE_ITEM_ALIASES = {
    'Allay Spawn Egg': 'spawn-egg',
    'Decorated Pot': 'flower-pot',
    'Polished Deepslate Wall': 'polished-deepslate',
    'Waxed Weathered Copper': 'weathered-copper',
};

export function getMinecraftTextureKey(baseItem) {
    if (!baseItem) return null;
    if (BASE_ITEM_ALIASES[baseItem]) return BASE_ITEM_ALIASES[baseItem];
    return baseItem.replaceAll(' ', '-').replaceAll('_', '-').toLowerCase();
}
