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
    const mapped = map[itemName] || map[itemName.replace(/^EX\s+/, '')];
    return mapped ? `monumenta-${mapped}` : null;
}
