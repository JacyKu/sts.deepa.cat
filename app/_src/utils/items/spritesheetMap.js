import { getStsBase } from '../base';

let spriteMapPromise;
let spriteMapCache;

export function loadItemSpriteMap() {
    if (spriteMapCache) {
        return Promise.resolve(spriteMapCache);
    }
    if (!spriteMapPromise) {
        spriteMapPromise = fetch(getStsBase() + '/spritesheets/itemsheet-map.json')
            .then((response) => (response.ok ? response.json() : {}))
            .catch(() => ({}))
            .then((map) => {
                spriteMapCache = map || {};
                return spriteMapCache;
            });
    }
    return spriteMapPromise;
}

export function getMappedSpriteClass(map, itemName) {
    if (!map || !itemName) {
        return null;
    }
    // EX items ("EX Wand of Spring") don't have their own spritesheet entry;
    // they share the texture of the base item ("Wand of Spring").
    const base = itemName.replace(/^EX\s+/, '');
    const mapped = map[base] || map[itemName];
    if (mapped) {
        return `monumenta-${mapped}`;
    }
    // Some sprites are only catalogued under a masterwork-tier key
    // ("Judgement of the Voidstained-4"), while the item row is the plain
    // name. Fall back to the matching tier key, preferring the highest one.
    // The candidate groups are built once per map: this used to filter and
    // sort all ~6,700 map keys on every miss.
    const tierless = base.replace(/-\d+$/, '');
    const tiered = tierFallbackLookup(map).get(tierless) || [];
    for (const { key } of tiered) {
        if (key === base || key === itemName) continue;
        return `monumenta-${map[key]}`;
    }
    return null;
}

// tierless name -> its keys, highest masterwork tier first.
let tierFallbackCache = null;
let tierFallbackCacheMap = null;

function tierFallbackLookup(map) {
    if (tierFallbackCacheMap !== map) {
        const groups = new Map();
        for (const key of Object.keys(map)) {
            const tierless = key.replace(/^EX\s+/, '').replace(/-\d+$/, '');
            let list = groups.get(tierless);
            if (!list) groups.set(tierless, (list = []));
            list.push({ key, tier: tierOf(key) });
        }
        for (const list of groups.values()) list.sort((a, b) => b.tier - a.tier);
        tierFallbackCache = groups;
        tierFallbackCacheMap = map;
    }
    return tierFallbackCache;
}

// Custom items store a chosen texture token, but a later spritesheet import
// can drop tokens (renamed items, changed normalization). Check the token
// still exists before applying its class, so those items fall back to their
// name/base texture instead of rendering a wrong sheet cell.
let tokenSetCache = null;
let tokenSetCacheMap = null;

export function isKnownSpriteToken(map, token) {
    if (!map || !token) return false;
    if (tokenSetCacheMap !== map) {
        tokenSetCache = new Set(Object.values(map));
        tokenSetCacheMap = map;
    }
    return tokenSetCache.has(token);
}

function tierOf(name) {
    const m = /-(\d+)$/.exec(name);
    return m ? Number(m[1]) : 0;
}
