import { CHARM_TRADERS } from '../../data/charmTraders';

// Basic/generic charms have no article of their own on the wiki; the charm
// trader list documents where they are sold. Named charms keep their own page.
export const CHARM_TRADERS_WIKI = 'https://monumenta.wiki.gg/wiki/List_of_Charm_Traders';

// Charms that do have their own wiki article (checked against the wiki), so
// they keep a name-based link instead of the trader list. Base-tier charms are
// the ones the traders sell; the legacy ones are old generic charms (the
// trader list's "Other Charm Traders" section covers their refunds).
const BASE_CHARMS_WITH_ARTICLES = new Set([
    'Distant Artillery Charm',
    'Empowering Antidote Charm',
    'Empowering Charm of Conversion',
    'Greater Zephyr Charm',
    'Lesser Antidote Charm',
    'Lesser Artillery Charm',
    'Lesser Brutal Charm',
    'Lesser Charm of Conversion',
    'Lesser Charm of Insight',
    'Lesser Enhancing Charm',
    'Lesser Fissure Charm',
    'Lesser Forbidden Charm',
    'Lesser Gruesome Charm',
    'Lesser Innate Charm',
    'Lesser Iron Charm',
    'Swiftwood Arrow',
]);
const LEGACY_CHARMS_WITH_ARTICLES = new Set([
    'Amber Amulet',
    'Bewildered Eye',
    'Corroded Sconce',
    'Flawless Spores',
    'Hemobijou',
    'Imperial Jewel',
    'Infernal Shard',
    'Lesser Odor Charm',
    'Live Explosive',
    'Maestro Bauble',
    'Thunderous Plate',
]);

export function isGenericCharm(item) {
    // Custom items are player-made; the wiki does not cover them.
    if (!item || item.isCustomItem || String(item.type || '').toLowerCase() !== 'charm') return false;
    if (item.tier === 'Base') return !BASE_CHARMS_WITH_ARTICLES.has(item.name);
    if (item.tier === 'Legacy') return !LEGACY_CHARMS_WITH_ARTICLES.has(item.name);
    return false;
}

// Wiki article for an item: the trader list for basic/generic charms, the
// item's own page for everything else.
export function wikiHref(name, item) {
    if (isGenericCharm(item)) return CHARM_TRADERS_WIKI;
    return `https://monumenta.wiki.gg/wiki/${String(name)
        .replace(/\(.*\)/g, '')
        .trim()
        .replaceAll(' ', '_')}`;
}

const skillSlug = (skill) =>
    String(skill)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');

// Skills the item data still names the old way.
const SKILL_ALIASES = {
    spiritual_combos: 'Crystalline Combos',
};

const TRADERS_BY_SKILL = new Map();
for (const trader of CHARM_TRADERS) {
    for (const skill of trader.skills) {
        const slug = skillSlug(skill);
        if (!TRADERS_BY_SKILL.has(slug)) TRADERS_BY_SKILL.set(slug, []);
        TRADERS_BY_SKILL.get(slug).push(trader);
    }
}
for (const [oldSlug, skill] of Object.entries(SKILL_ALIASES)) {
    const traders = TRADERS_BY_SKILL.get(skillSlug(skill));
    if (traders) TRADERS_BY_SKILL.set(oldSlug, traders);
}
// Longest first, so a stat key matches the most specific skill when one skill
// name happens to be a prefix of another.
const SKILL_SLUGS = [...TRADERS_BY_SKILL.keys()].sort((a, b) => b.length - a.length);

// Charms carry their skill in the stat keys ("arcane_strike_damage_percent"),
// which is enough to find the seller without a per-item mapping. Cached by
// item name: the items page renders hundreds of charms at once.
const tradersCache = new Map();

export function charmTradersFor(item) {
    if (!item || item.isCustomItem || String(item.type || '').toLowerCase() !== 'charm' || item.tier !== 'Base')
        return [];
    const cached = tradersCache.get(item.name);
    if (cached) return cached;

    const found = new Map();
    for (const key of Object.keys(item.stats || {})) {
        const slug = SKILL_SLUGS.find((candidate) => key === candidate || key.startsWith(candidate + '_'));
        if (!slug) continue;
        for (const trader of TRADERS_BY_SKILL.get(slug)) found.set(trader.npc, trader);
    }
    const traders = [...found.values()];
    tradersCache.set(item.name, traders);
    return traders;
}
