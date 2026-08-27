import { NextResponse } from 'next/server';
import { getItemData } from '../../../../_src/utils/itemsData';
// Free-text item search (used by the Discord bot):
//   /api/v1/items/search?q=...&limit=...
// Matches item names (case-insensitive substring) and, for charms, their
// ability text - the same matching the items page uses. Masterwork variants
// are grouped under the base name, like the item tiles do. An empty q
// returns the first `limit` items (used for the bot's initial autocomplete
// list before the user types).
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 25));

    const itemData = await getItemData();
    const results = [];
    const seen = new Set();
    for (const item of Object.values(itemData)) {
        if (item.base_item === 'Written Book') continue;
        const name = String(item.name || '').toLowerCase();
        const matches = !q || name.includes(q) || (item.type === 'Charm' && charmAbilityText(item).includes(q));
        if (!matches) continue;
        // Group masterwork variants under the base name (first entry wins).
        if (seen.has(item.name)) continue;
        seen.add(item.name);
        results.push({
            name: item.name,
            type: item.type || null,
            tier: item.tier || null,
            location: item.location || null,
            region: item.region || null,
            baseItem: item.base_item || null,
            masterwork: Number(item.masterwork) || 0,
            power: item.power != null ? Number(item.power) : null,
        });
        if (results.length >= limit) break;
    }
    return NextResponse.json({ count: q ? seen.size : results.length, results });
}

// Human-readable charm ability text, so searches can match abilities the same
// way the items page does (stat values + humanized names).
function charmAbilityText(item) {
    const parts = [];
    for (const [stat, v] of Object.entries(item.stats || {})) {
        const value = typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
        if (value === undefined || value === null) continue;
        const human = stat
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        parts.push(`${Number(value) > 0 ? '+' : ''}${value} ${human}`);
    }
    return parts.join(', ').toLowerCase();
}
