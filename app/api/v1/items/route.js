import { NextResponse } from 'next/server';
import { getItemData } from '../../../_src/utils/itemsData';

// Single-item lookup for the build-card hover preview and the Discord bot:
//   /api/v1/items?name=...&type=charm&power=3
//   /api/v1/items?name=...&masterwork=4
// Items with masterwork variants share one display name; without a masterwork
// param the highest-level variant is returned (the "max masterwork" default).
// The response carries masterworkMax so clients can render "Level X / Y".
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const type = searchParams.get('type');
    const power = searchParams.get('power');
    const masterworkRaw = searchParams.get('masterwork');
    if (!name) {
        return NextResponse.json({ error: 'missing name' }, { status: 400 });
    }

    const itemData = await getItemData();
    let item = null;
    if (type === 'charm') {
        const wantedPower = power != null ? Number(power) : null;
        item =
            Object.values(itemData).find(
                (i) => i.name === name && i.type === 'Charm' && (wantedPower == null || Number(i.power) === wantedPower)
            ) || null;
    } else {
        const named = Object.values(itemData).filter((i) => i.name === name);
        const pool = named.length > 0 ? named : itemData[name] ? [itemData[name]] : [];
        if (pool.length > 0) {
            const maxMasterwork = Math.max(...pool.map((i) => Number(i.masterwork) || 0));
            const wanted = masterworkRaw != null ? Math.max(0, Math.min(maxMasterwork, Number(masterworkRaw))) : null;
            item = pool.find((i) => Number(i.masterwork) === (wanted ?? maxMasterwork));
            if (!item) item = pool.find((i) => Number(i.masterwork) === maxMasterwork) || pool[0];
            if (maxMasterwork > 0) {
                const masterworkLevels = [...new Set(pool.map((i) => Number(i.masterwork) || 0))].sort((a, b) => a - b);
                item = { ...item, masterworkMax: maxMasterwork, masterworkLevels };
            }
        }
    }
    return NextResponse.json({ item });
}
