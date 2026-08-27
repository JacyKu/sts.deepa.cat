// Categorizes the stats that exist in Monumenta (derived from the items.json
// stat keys, which mirror the plugin's attribute/enchant/curse enums) into the
// same subcategories the plugin uses for its item lore. Used by the custom
// item importer to offer a grouped stat dropdown.

const SUFFIX_RE = /_(percent|flat|base)$/;

// Plain-name curses (no curse_ prefix, no _fragility suffix).
const PLAIN_CURSES = new Set([
    'two_handed',
    'starvation',
    'ineptitude',
    'cumbersome',
    'oversized',
    'consumption',
    'undroppable',
]);

// Attribute bases, with and without their _percent/_flat/_base suffixes.
const ATTRIBUTE_BASES = new Set([
    'armor',
    'agility',
    'max_health',
    'speed',
    'attack_damage',
    'attack_speed',
    'projectile_damage',
    'projectile_speed',
    'throw_rate',
    'potion_damage',
    'potion_radius',
    'potion_recharge_rate',
    'spell_power',
    'knockback_resistance',
    'thorns',
]);

// Plugin's "Protections" group.
const PROTECTIONS = new Set([
    'melee_protection',
    'projectile_protection',
    'blast_protection',
    'magic_protection',
    'fire_protection',
    'feather_falling',
]);

// Plugin's "Defense Scaling" group.
const DEFENSE_SCALING = new Set([
    'shielding',
    'inure',
    'poise',
    'steadfast',
    'guard',
    'tempo',
    'reflexes',
    'ethereal',
    'evasion',
    'cloaked',
    'adaptability',
]);

// Returns [{ label, stats: [key, ...] }] in display order, each list sorted.
export function buildStatCategories(itemData) {
    const buckets = {
        Attributes: [],
        'Base Stats': [],
        Protections: [],
        'Defense Scaling': [],
        Enchantments: [],
        Curses: [],
        'Ability Stats': [],
    };
    const seen = new Set();
    for (const itemKey of Object.keys(itemData)) {
        for (const stat of Object.keys(itemData[itemKey].stats || {})) {
            if (stat === 'noglint' || seen.has(stat)) {
                continue;
            }
            seen.add(stat);
            const suffixMatch = SUFFIX_RE.exec(stat);
            const base = suffixMatch ? stat.slice(0, suffixMatch.index) : stat;
            if (stat.startsWith('curse_') || stat.endsWith('_fragility') || PLAIN_CURSES.has(stat)) {
                buckets.Curses.push(stat);
            } else if (suffixMatch && suffixMatch[1] === 'base') {
                buckets['Base Stats'].push(stat);
            } else if (ATTRIBUTE_BASES.has(base)) {
                buckets.Attributes.push(stat);
            } else if (suffixMatch) {
                buckets['Ability Stats'].push(stat);
            } else if (PROTECTIONS.has(stat)) {
                buckets.Protections.push(stat);
            } else if (DEFENSE_SCALING.has(stat)) {
                buckets['Defense Scaling'].push(stat);
            } else {
                buckets.Enchantments.push(stat);
            }
        }
    }
    return Object.entries(buckets)
        .filter(([, list]) => list.length > 0)
        .map(([label, stats]) => ({ label, stats: [...stats].sort() }));
}
