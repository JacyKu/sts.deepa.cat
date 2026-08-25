// Server-side helpers for the public build database: derived filter columns
// are computed from the share token once at save/publicise time, so browsing
// and filtering never has to decode tokens at request time.
import { decodeBuildParam } from '../app/_src/utils/builder/buildUrlCodec';
import { getLinkPreviewData, getRegionLabel } from '../app/_src/utils/buildPreview';
import { filterBadWords } from '../app/_src/utils/badWords';
import czAbilitiesData from '../public/items/czAbilities.json';

// The Celestial Zenith trees in display order (the tree shown for a build is
// the first main tree that contains any of its abilities).
const CZ_MAIN_TREES = [
    'Dawnbringer',
    'Earthbound',
    'Flamecaller',
    'Frostborn',
    'Shadowdancer',
    'Steelsage',
    'Windwalker',
    'Prismatic',
];

// True when the text contains a blocked word (the same list the builder's
// live profanity filter uses). Publicising a build with a bad name/notes is
// rejected so the database never surfaces them.
export function hasBadWords(text) {
    return filterBadWords(text).found;
}

// Check a build's name + notes + token-embedded name for blocked words.
export function hasProfanity({ name, notes, token, itemData }) {
    let tokenName = null;
    if (token && itemData) {
        try {
            const decoded = decodeBuildParam(token, itemData);
            if (decoded) tokenName = new URLSearchParams(decoded).get('name');
        } catch (e) {
            tokenName = null;
        }
    }
    return hasBadWords([name, tokenName, notes].filter(Boolean).join(' '));
}

// Two-letter abbreviation (first letter of the first two words), or a single
// letter for one-word skill names — the same style the embed chips use.
function skillAbbr(name, fallback) {
    if (name) {
        const words = String(name).split(/\s+/).filter(Boolean);
        if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
        return words[0][0].toUpperCase();
    }
    return fallback || '?';
}

// Compute the denormalized filter columns for a build token.
// Returns null when the token doesn't decode (callers treat that as invalid).
export function computeBuildSummary(token, itemData, skillsData) {
    const data = getLinkPreviewData(token, itemData, skillsData);
    if (!data) return null;

    const previewItems = [];
    let masterworkCount = 0;
    for (const [slot, key] of Object.entries(data.items)) {
        if (!key || key === 'None') continue;
        const item = itemData[key];
        if (item) {
            previewItems.push({
                n: item.name || key,
                m: Number(item.masterwork) || 0,
                b: item.base_item || null,
                t: item.tier || null,
                sl: slot,
            });
            if (Number(item.masterwork) > 0) masterworkCount += 1;
        }
    }
    const charmNames = data.charms.items.map((c) => c.name);

    // Embed-style chips: two-letter abbreviations, group (base/spec) for the
    // chip color, enhanced flag, and points (with * when enhanced). The full
    // name is kept inside so the skill search filter matches either form.
    const skillEntries = [];
    const enhancedIds = new Set((data.enhancements || []).map((e) => (typeof e === 'string' ? e : e.id)));
    for (const s of data.skills) {
        skillEntries.push({
            n: skillAbbr(s.name, s.shortName || s.id),
            f: s.name || s.id,
            p: Number(s.points) || 0,
            g: 'b',
            e: enhancedIds.has(s.id) ? 1 : 0,
        });
    }
    for (const s of data.specSkills) {
        skillEntries.push({
            n: skillAbbr(s.name, s.shortName || s.id),
            f: s.name || s.id,
            p: Number(s.points) || 0,
            g: 's',
            e: enhancedIds.has(s.id) ? 1 : 0,
        });
    }
    // Celestial Zenith / Darkest Depths abilities: abbreviation + full name
    // (always Twisted — rarity is gone). The tree is the first main tree
    // holding one of them.
    let czTree = null;
    const czNames = data.czAbilities;
    if (czNames.length > 0) {
        const treesByAbility = new Map();
        for (const t of czAbilitiesData.trees || []) {
            for (const s of t.skills || []) treesByAbility.set(s.name, t.tree);
        }
        czTree =
            CZ_MAIN_TREES.find((tree) => czNames.some((name) => treesByAbility.get(name) === tree)) || null;
    }
    for (const name of data.czAbilities) {
        skillEntries.push({ n: skillAbbr(name, name), f: name, g: 'c' });
    }

    const itemCount = Object.values(data.items).filter((k) => k && k !== 'None').length;
    const skillPointCount =
        data.skills.reduce((sum, s) => sum + (Number(s.points) || 0), 0) +
        data.specSkills.reduce((sum, s) => sum + (Number(s.points) || 0), 0);

    return {
        class_name: data.className || null,
        spec: data.spec || null,
        region: getRegionLabel(data.region, data.czAbilities.length > 0),
        power: data.charms.totalPower || 0,
        has_charms: data.charms.items.length > 0 ? 1 : 0,
        masterwork_count: masterworkCount,
        charm_count: data.charms.items.length,
        ascension: data.ascension || 0,
        enhancement_count: data.enhancements.length,
        skill_point_count: skillPointCount,
        item_count: itemCount,
        cz_tree: czTree,
        skills_json: JSON.stringify(skillEntries),
        items_json: JSON.stringify([
            ...previewItems,
            ...data.charms.items.map((c) => ({
                n: c.name,
                pw: c.power != null ? Number(c.power) : null,
                t: c.tier || null,
                c: c.class_name || null,
            })),
        ]),
    };
}
