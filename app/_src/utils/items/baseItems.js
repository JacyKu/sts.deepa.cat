// Builds the list of vanilla base items (e.g. "Wooden Axe", "Netherite
// Sword") offered when choosing a custom item's base. The vocabulary is the
// distinct `base_item` values the real items use - exactly the names the
// builder's item tiles render and use for their vanilla fallback textures.
export function baseItemOptionsFrom(itemData) {
    const seen = new Set();
    for (const item of Object.values(itemData)) {
        const base = item && item.base_item;
        if (typeof base === 'string' && base.trim()) seen.add(base.trim());
    }
    return [...seen].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
}
