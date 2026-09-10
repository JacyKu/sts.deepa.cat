import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../lib/session';
import { saveCustomItem, listCustomItems, hasCustomItemName, countRecentCustomItems } from '../../../../lib/sts-builds';
import { rateLimitResponse, readRateLimits } from '../../../../lib/rate-limit';

export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'invalid name' }, { status: 400 });
    }
    const name = body.name.trim();
    if (name.length > 64) {
        return NextResponse.json({ error: 'name too long' }, { status: 400 });
    }
    // Duplicate names would silently overwrite each other in the builder's
    // name-keyed item data, so reject them per user (names that match base
    // items or other users' items are fine - each item keeps its own id).
    if (hasCustomItemName(user.id, name)) {
        return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }
    const textureToken = typeof body.textureToken === 'string' ? body.textureToken : '';
    if (!textureToken || textureToken.length > 64 || !/^[a-z0-9_]+$/.test(textureToken)) {
        return NextResponse.json({ error: 'invalid texture' }, { status: 400 });
    }
    const type = typeof body.type === 'string' && body.type.length <= 32 ? body.type : 'Miscellaneous';
    const textureName =
        typeof body.textureName === 'string' && body.textureName.length <= 128 ? body.textureName : null;
    const baseItem =
        typeof body.baseItem === 'string' && body.baseItem.trim().length <= 64 ? body.baseItem.trim() : null;

    const stats = {};
    if (body.stats && typeof body.stats === 'object') {
        for (const [key, value] of Object.entries(body.stats)) {
            if (!/^[a-z0-9_']+$/.test(key) || key.length > 128) continue;
            const number = Number(value);
            if (Number.isFinite(number) && number !== 0) {
                stats[key] = number;
            }
        }
    }
    if (Object.keys(stats).length > 50) {
        return NextResponse.json({ error: 'too many stats' }, { status: 400 });
    }

    // Daily upload limit (site and mod item uploads share the account budget).
    const limits = readRateLimits();
    if (limits.customItemsPerDay > 0 && countRecentCustomItems(user.id, 24 * 60) >= limits.customItemsPerDay) {
        return rateLimitResponse({ hint: 'Daily custom item limit reached. Try again tomorrow.' });
    }

    const item = saveCustomItem({
        userId: user.id,
        name,
        type,
        textureToken,
        textureName,
        stats,
        baseItem,
        authorName: user.globalName || user.username || null,
        authorAvatar: user.avatar || null,
    });
    if (!item) {
        return NextResponse.json({ error: 'save failed' }, { status: 400 });
    }
    return NextResponse.json({ id: item.id });
}

export async function GET() {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ items: listCustomItems(user.id) });
}
