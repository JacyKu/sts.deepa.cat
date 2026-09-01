import { NextResponse } from 'next/server';
import { getItemData, getRawItems } from '../../../_src/utils/itemsData';
import { countDisplayItems } from '../../../_src/utils/itemList';
import fs from 'fs';
import path from 'path';

let mapCache = null;
let mapCacheKey = null;

function getMappedItems() {
    const mapPath = path.join(process.cwd(), 'public', 'spritesheets', 'itemsheet-map.json');
    try {
        const stat = fs.statSync(mapPath);
        if (!mapCache || mapCacheKey !== stat.mtimeMs) {
            mapCache = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            mapCacheKey = stat.mtimeMs;
        }
        return mapCache;
    } catch (e) {
        return null;
    }
}

export async function GET() {
    const items = await getRawItems().catch(() => null);
    const map = getMappedItems();

    if (!items) {
        return NextResponse.json({ error: 'Unable to read public/items/items.json' }, { status: 500 });
    }
    if (!map) {
        return NextResponse.json({ error: 'Unable to read public/spritesheets/itemsheet-map.json' }, { status: 500 });
    }

    // The catalogued count is what the items page shows: masterwork levels
    // of one item count as a single item, Written Books are hidden. The raw
    // key set is still used below for the texture-map coverage numbers.
    const itemData = await getItemData();
    const itemNames = Object.keys(items);
    const mappedNames = Object.keys(map);

    const mappedSet = new Set(mappedNames);
    const itemSet = new Set(itemNames);

    const missingFromTexturePack = [];
    for (const name of itemNames) {
        if (!mappedSet.has(name)) missingFromTexturePack.push(name);
    }

    const orphansInMap = [];
    for (const name of mappedNames) {
        if (!itemSet.has(name)) orphansInMap.push(name);
    }

    return NextResponse.json({
        totals: {
            items: countDisplayItems(itemData),
            mapped: mappedNames.length,
            missing: missingFromTexturePack.length,
            mapOrphans: orphansInMap.length,
            mappedPercent: itemNames.length ? mappedNames.length / itemNames.length : 0,
        },
        samples: {
            missingFirst50: missingFromTexturePack.slice(0, 50),
            orphansFirst50: orphansInMap.slice(0, 50),
        },
    });
}
