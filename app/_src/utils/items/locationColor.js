// Inline color for an item's location text (and name): the exact color of the
// location line in the game's NBT lore, captured per item by
// scripts/update-items.mjs so API renames can never break the mapping. Items
// without it (custom items, dumps without NBT) keep the CSS palette in
// Items.module.css.
export function locationStyle(item) {
    return item && item.locationColor ? { color: item.locationColor } : undefined;
}
