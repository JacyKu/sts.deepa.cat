// The item type vocabulary for custom items, grouped by where they equip.
// The concrete options mirror the items page search filter's "Item Type"
// list exactly - same values, same display labels ("Misc mainhands" for
// `Mainhand`, etc.). The search filter's aggregate tokens ("All mainhands",
// "All melee mainhands", "All offhands") are shown too so the dropdown reads
// identically, but they are disabled: a custom item has to store one real
// type string for the builder to slot/classify it.
export const ITEM_TYPE_GROUPS = [
    {
        label: 'Armor',
        types: ['Helmet', 'Chestplate', 'Leggings', 'Boots'],
    },
    {
        label: 'Mainhand',
        types: [
            { value: 'ALL_MAINHANDS', label: 'All mainhands', isDisabled: true },
            { value: 'ALL_MELEE_MAINHANDS', label: 'All melee mainhands', isDisabled: true },
            { value: 'Mainhand', label: 'Misc mainhands' },
            'Mainhand Sword',
            'Mainhand Shield',
            'Axe',
            'Pickaxe',
            'Trident',
            'Scythe',
            'Shovel',
            'Bow',
            'Crossbow',
            'Wand',
            'Snowball',
            'Projectile',
        ],
    },
    {
        label: 'Offhand',
        types: [
            { value: 'ALL_OFFHANDS', label: 'All offhands', isDisabled: true },
            { value: 'Offhand', label: 'Misc offhands' },
            'Offhand Sword',
            'Offhand Shield',
        ],
    },
    {
        label: 'Other',
        types: ['Alchemist Bag', 'Consumable', 'Misc', 'Charm'],
    },
];

function typeOption(entry) {
    return typeof entry === 'string' ? { value: entry, label: entry } : entry;
}

// Grouped react-select options (labels preserved, aggregate tokens disabled).
export const ITEM_TYPE_OPTIONS = ITEM_TYPE_GROUPS.map((group) => ({
    label: group.label,
    options: group.types.map(typeOption),
}));

// Flat, de-duplicated list of every *storable* type value (used by the
// database filter and anything needing the plain vocabulary). Aggregate
// tokens are excluded - they are filter shortcuts, not item types.
export const ITEM_TYPES = [
    ...new Set(
        ITEM_TYPE_GROUPS.flatMap((group) => group.types.map(typeOption))
            .filter((o) => !o.isDisabled)
            .map((o) => o.value)
    ),
];

// Aggregate "All X" tokens used by the items page search's Item Type filter:
// each expands to the concrete item types it matches. Kept in sync with the
// search form's own TYPE_GROUPS so filters behave identically everywhere.
export const ITEM_TYPE_TOKEN_GROUPS = {
    ALL_MAINHANDS: [
        'Mainhand',
        'Mainhand Shield',
        'Mainhand Sword',
        'Axe',
        'Pickaxe',
        'Trident',
        'Scythe',
        'Shovel',
        'Bow',
        'Snowball',
        'Crossbow',
        'Wand',
        'Alchemist Bag',
    ],
    ALL_MELEE_MAINHANDS: [
        'Mainhand',
        'Mainhand Shield',
        'Mainhand Sword',
        'Axe',
        'Pickaxe',
        'Trident',
        'Scythe',
        'Shovel',
    ],
    ALL_OFFHANDS: ['Offhand', 'Offhand Sword', 'Offhand Shield'],
};

function labelOption(value, label) {
    return { value, label };
}

// The database Type filter's full option list: the items search "Item Type"
// options one-to-one (aggregate tokens included as working group filters),
// plus the legacy "Miscellaneous"/"Trinket" values so older custom items can
// still be filtered.
export const ITEM_FILTER_OPTIONS = [
    'Helmet',
    'Chestplate',
    'Leggings',
    'Boots',
    labelOption('ALL_MAINHANDS', 'All mainhands'),
    labelOption('ALL_MELEE_MAINHANDS', 'All melee mainhands'),
    labelOption('Mainhand', 'Misc mainhands'),
    'Mainhand Sword',
    'Mainhand Shield',
    'Axe',
    'Pickaxe',
    'Trident',
    'Scythe',
    'Shovel',
    'Bow',
    'Crossbow',
    'Wand',
    'Snowball',
    'Projectile',
    labelOption('ALL_OFFHANDS', 'All offhands'),
    labelOption('Offhand', 'Misc offhands'),
    'Offhand Sword',
    'Offhand Shield',
    'Alchemist Bag',
    'Consumable',
    'Misc',
    'Charm',
    'Miscellaneous',
    'Trinket',
];
