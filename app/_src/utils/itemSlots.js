// Raw item types -> the slot each one equips into. Types not listed here
// (Misc, Consumable, Written Book, ...) cannot be equipped, so they are not
// gear. Shared by the builder's item filter (which groups values per slot)
// and the items page's "hide non-gear items" toggle.
export const SLOT_BY_TYPE = {
    Mainhand: 'Mainhand',
    'Mainhand Sword': 'Mainhand',
    'Mainhand Shield': 'Mainhand',
    Axe: 'Mainhand',
    Pickaxe: 'Mainhand',
    Scythe: 'Mainhand',
    Bow: 'Mainhand',
    Crossbow: 'Mainhand',
    Wand: 'Mainhand',
    Snowball: 'Mainhand',
    Trident: 'Mainhand',
    Shovel: 'Mainhand',
    Projectile: 'Mainhand',
    Offhand: 'Offhand',
    'Offhand Sword': 'Offhand',
    'Offhand Shield': 'Offhand',
    'Alchemist Bag': 'Offhand',
    Helmet: 'Helmet',
    Chestplate: 'Chestplate',
    Leggings: 'Leggings',
    Boots: 'Boots',
    Charm: 'Charm',
};

// True when the raw item type equips into a slot ("Helmet", "Mainhand Sword",
// "Charm", ...); false for materials, consumables, books and other non-gear.
export function isGearType(type) {
    return Boolean(SLOT_BY_TYPE[type]);
}

// Tiers that are never gear, even when the type is a slot: dungeon "key" items
// are typed as the weapon/armour they stand in for (a key that is a Crossbow,
// key boots, ...) but they are not equipment - their lore says taking them out
// of the dungeon drops them.
export const NON_GEAR_TIERS = new Set(['Key']);

// True when an item is equipment: an equippable type and not a key item.
export function isGearItem(item) {
    return Boolean(item) && isGearType(item.type) && !NON_GEAR_TIERS.has(item.tier);
}
