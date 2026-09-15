import { getItemData, getSkillsData } from './itemsData';
import czAbilitiesData from '../../../public/items/czAbilities.json';

// Raw item types -> the builder slot they equip into (used to group the
// item filter's value dropdown per slot). Everything else (Misc, Consumable,
// Written Book, ...) can't be equipped, so it never appears in builds.
const SLOT_BY_TYPE = {
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

let groupsCache = null;
let groupsCacheKey = null;

// Slot -> sorted list of distinct display names. getItemData returns the same
// object until the data files change, so the reference is a safe cache key.
async function getItemGroups() {
    const itemData = await getItemData();
    if (groupsCache && groupsCacheKey === itemData) return groupsCache;
    const groups = {};
    for (const [itemKey, item] of Object.entries(itemData)) {
        const slot = SLOT_BY_TYPE[item.type];
        if (!slot) continue;
        const name = item.name || itemKey;
        if (!groups[slot]) groups[slot] = [];
        if (!groups[slot].includes(name)) groups[slot].push(name);
    }
    for (const slot of Object.keys(groups)) {
        groups[slot].sort((a, b) => a.localeCompare(b));
    }
    groupsCache = groups;
    groupsCacheKey = itemData;
    return groups;
}

// Class / spec / item-group / skill options shared by the database and My
// Builds pages. Skill names are the full names stored in a build's
// skills_json (displayName, since some passives have no plain `name`).
// `skillMap` groups them per class (base skills + that class's spec skills) so
// the Skill filter can narrow down once a Class filter is chosen. The
// Celestial Zenith / Darkest Depths abilities are class-independent, so they
// only appear in the full `skillOptions` list (no Class filter selected).
export async function getBuildFilterData() {
    const [skillsData, itemGroups] = await Promise.all([getSkillsData(), getItemGroups()]);
    const classOptions = skillsData.classes.map((c) => c.className);
    const specMap = {};
    const skillMap = {};
    const skillNames = new Set();
    for (const c of skillsData.classes) {
        specMap[c.className] = (c.specs || []).map((s) => s.specName);
        const list = [];
        for (const s of c.skills || []) {
            const label = s.displayName || s.name;
            if (label) list.push(label);
        }
        for (const sp of c.specs || []) {
            for (const s of sp.specSkills || []) {
                const label = s.displayName || s.name;
                if (label) list.push(label);
            }
        }
        skillMap[c.className] = [...new Set(list)].sort((a, b) => a.localeCompare(b));
        for (const label of skillMap[c.className]) skillNames.add(label);
    }
    for (const tree of czAbilitiesData.trees || []) {
        for (const s of tree.skills || []) {
            const label = s.displayName || s.name;
            if (label) skillNames.add(label);
        }
    }
    const skillOptions = [...skillNames].sort((a, b) => a.localeCompare(b));
    return { classOptions, specMap, itemGroups, skillOptions, skillMap };
}
