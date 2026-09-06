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
    const tierless = base.replace(/-\d+$/, '');
    const tiered = Object.keys(map)
        .filter((key) => key !== base && key !== itemName && key.replace(/^EX\s+/, '').replace(/-\d+$/, '') === tierless)
        .sort((a, b) => tierOf(b) - tierOf(a));
    return tiered.length > 0 ? `monumenta-${map[tiered[0]]}` : null;
}

function tierOf(name) {
    const m = /-(\d+)$/.exec(name);
    return m ? Number(m[1]) : 0;
}
