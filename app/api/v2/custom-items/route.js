import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../lib/session';
import { sanctionBlock } from '../../../../lib/moderation';
import {
    saveCustomItem,
    listCustomItems,
    hasCustomItemName,
    countRecentCustomItems,
    customItemFavouriteStates,
    preferredAuthorAvatar,
    BUILD_NAME_MAX,
} from '../../../../lib/sts-builds';
import { rateLimitResponse, readRateLimits } from '../../../../lib/rate-limit';
import { bodyTooLarge, tooLargeJson } from '../../../../lib/request-guards';
import {
    buildCustomItemVocab,
    coerceItemType,
    coerceBaseItem,
    sanitizeItemStats,
} from '../../../../lib/custom-item-vocab';
import { getItemData } from '../../../_src/utils/itemsData';

export async function POST(request) {
    const user = await getDiscordUser();
    // Banned/suspended accounts may browse but not create content.
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (bodyTooLarge(request)) return tooLargeJson();

    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'invalid name' }, { status: 400 });
    }
    const name = body.name.trim();
    if (name.length > BUILD_NAME_MAX) {
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
    // Type, base item and stats are validated against the site's own item
    // vocabulary (the same data the client dropdowns use): unknown values are
    // coerced instead of trusting whatever the request contains.
    const vocab = buildCustomItemVocab(await getItemData());
    const type = coerceItemType(body.type, vocab);
    const textureName =
        typeof body.textureName === 'string' && body.textureName.length <= 128 ? body.textureName : null;
    const baseItem = coerceBaseItem(body.baseItem, vocab);

    const stats = sanitizeItemStats(body.stats, vocab);

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
        authorAvatar: preferredAuthorAvatar(user.id, user.avatar),
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
    const items = listCustomItems(user.id);
    const states = customItemFavouriteStates(
        items.map((item) => item.id),
        user.id
    );
    return NextResponse.json({
        items: items.map((item) => {
            const state = states[item.id];
            return {
                ...item,
                favouriteCount: state ? state.count : 0,
                myFavourite: state ? state.favourite : false,
            };
        }),
    });
}
