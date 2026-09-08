import fs from 'fs/promises';
import path from 'path';

let cache = null;
let cacheKey = null;
let rawCache = null;
let rawCacheKey = null;
let skillsCache = null;
let skillsCacheKey = null;
let czCache = null;
let czCacheKey = null;
let historyCache = null;
let historyCacheKey = null;

async function readJson(segments) {
    const filePath = path.join(process.cwd(), 'public', ...segments);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function processItemData(itemData, extras) {
    // hardcoded exemption for Truest North
    for (let i = 1; i <= 4; i++) {
        itemData['Truest North-' + i] = itemData['Truest North-' + i + ' (compass)'];
        delete itemData['Truest North-' + i + ' (compass)'];
        delete itemData['Truest North-' + i + ' (shears)'];
    }

    // hardcoded exemption for Carcano 91/38
    itemData['Carcano 9138'] = itemData['Carcano 91/38'];
    delete itemData['Carcano 91/38'];

    // hardcoded exemption: the API classifies 3-D Glasses as Misc, but it is a helmet
    for (const item in itemData) {
        if (itemData[item].name === '3-D Glasses') {
            itemData[item].type = 'Helmet';
        }
    }

    // Add OTM extra info based on item's name
    // (so that it gets copied the same to each masterwork level)
    for (const item in itemData) {
        const itemStats = itemData[item];
        // Extras
        if (extras[itemStats.name]) {
            itemData[item].extras = extras[itemStats.name];
        }
        // alch bag (must run before exalted)
        if (itemStats.stats.alchemical_utensil) {
            try {
                itemData[item].type = 'Alchemist Bag';
                delete itemData[item].stats.alchemical_utensil;
            } catch (e) {
                console.log(item);
            }
        }
        // Exalted
        if (itemStats.masterwork) {
            // If an item with the base, non-masterwork name exists, as a key
            if (itemData[itemStats.name]) {
                // Modify its name to have an "EX" at the start
                const exName = `EX ${itemStats.name}`;
                const mwExName = `${exName}-${itemData[item].masterwork}`;
                itemData[mwExName] = itemData[item];
                itemData[mwExName].name = exName;
                delete itemData[item];
                continue;
            }
        }
        if (itemStats.location == 'Skr') {
            itemData[item].location = "Silver Knight's Remnants";
        }
        switch (itemStats.location) {
            case 'Skr':
                itemData[item].location = "Silver Knight's Remnants";
                break;
            case 'SKT':
                itemData[item].location = "Silver Knight's Tomb";
                break;
            case 'Overworld3':
                itemData[item].location = "Architect's Ring Overworld";
                break;
        }
    }

    return itemData;
}

// Reads and processes items.json once, caching by file mtime.
// items.json is ~13.5MB so re-parsing on every request is expensive.
export async function getItemData() {
    const itemsPath = path.join(process.cwd(), 'public', 'items', 'items.json');
    const extrasPath = path.join(process.cwd(), 'public', 'items', 'extras.json');
    const [itemsStat, extrasStat] = await Promise.all([fs.stat(itemsPath), fs.stat(extrasPath)]);
    const key = itemsStat.mtimeMs + ':' + extrasStat.mtimeMs;

    if (cache && cacheKey === key) return cache;

    const [items, extras] = await Promise.all([readJson(['items', 'items.json']), readJson(['items', 'extras.json'])]);

    cache = processItemData(items, extras);
    cacheKey = key;
    return cache;
}

// Raw, unprocessed items.json (cached). Used by the coverage checker.
export async function getRawItems() {
    const itemsPath = path.join(process.cwd(), 'public', 'items', 'items.json');
    const stat = await fs.stat(itemsPath);
    const key = stat.mtimeMs;

    if (rawCache && rawCacheKey === key) return rawCache;

    rawCache = await readJson(['items', 'items.json']);
    rawCacheKey = key;
    return rawCache;
}

// Class skills from the Monumenta API (cached). Used by the builder.
export async function getSkillsData() {
    const skillsPath = path.join(process.cwd(), 'public', 'items', 'skills.json');
    const stat = await fs.stat(skillsPath);
    const key = stat.mtimeMs;

    if (skillsCache && skillsCacheKey === key) return skillsCache;

    skillsCache = await readJson(['items', 'skills.json']);
    skillsCacheKey = key;
    return skillsCache;
}

// Celestial Zenith / Darkest Depths ability trees (cached). Used by the builder.
export async function getCzData() {
    const czPath = path.join(process.cwd(), 'public', 'items', 'czAbilities.json');
    const stat = await fs.stat(czPath);
    const key = stat.mtimeMs;

    if (czCache && czCacheKey === key) return czCache;

    czCache = await readJson(['items', 'czAbilities.json']);
    czCacheKey = key;
    return czCache;
}

// Item stat change archive (public/items/item-history.json), written by
// scripts/update-items.mjs whenever an item dump is imported. Returns null
// when no archive has been recorded yet. Cached by file mtime like the rest.
export async function getItemHistory() {
    const historyPath = path.join(process.cwd(), 'public', 'items', 'item-history.json');
    let stat;
    try {
        stat = await fs.stat(historyPath);
    } catch (err) {
        return null; // no history recorded yet
    }
    const key = stat.mtimeMs;

    if (historyCache && historyCacheKey === key) return historyCache;

    historyCache = await readJson(['items', 'item-history.json']);
    historyCacheKey = key;
    return historyCache;
}
