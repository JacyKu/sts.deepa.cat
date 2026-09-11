import { NextResponse } from 'next/server';
import { getLinkByUuid, countRecentCustomItems, getStsUserProfile } from '../../../../../lib/sts-builds';
import { createUploadedCustomItems } from '../../../../../lib/item-uploads';
import { getItemData } from '../../../../_src/utils/itemsData';
import { getMinecraftProfile } from '../../../../../lib/minecraft-profile';
import { rateLimitResponse, readRateLimits } from '../../../../../lib/rate-limit';

// Upload items from the game as custom items on the linked account.
//
// The mod sends the item's in-game data (name, base item, type, colored lore
// lines, Stock enchantment levels) for the held item or for equipment in a
// build. Only linked UUIDs may upload: custom items are owned per account.
// Rate-limited so a leaked UUID can't flood an account with junk items.
export const runtime = 'nodejs';

const UPLOAD_BUDGET = { per: 30, minutes: 60 };

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const uuid = typeof body?.uuid === 'string' ? body.uuid : '';
    const link = getLinkByUuid(uuid);
    if (!link) {
        return NextResponse.json(
            { error: 'not linked', hint: 'Run /sts link in-game and confirm the link in your browser first.' },
            { status: 401 }
        );
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0 || items.length > 50) {
        return NextResponse.json({ error: 'invalid items' }, { status: 400 });
    }

    const used = countRecentCustomItems(link.discord_id, UPLOAD_BUDGET.minutes);
    if (used + items.length > UPLOAD_BUDGET.per) {
        return NextResponse.json({ error: 'too many uploads', hint: 'Try again in a bit.' }, { status: 429 });
    }

    // Daily upload limit on top of the hourly burst budget.
    const limits = readRateLimits();
    if (
        limits.customItemsPerDay > 0 &&
        countRecentCustomItems(link.discord_id, 24 * 60) + items.length > limits.customItemsPerDay
    ) {
        return rateLimitResponse({ hint: 'Daily custom item limit reached. Try again tomorrow.' });
    }

    // Author display: the Discord identity snapshot (the uploader has no
    // Discord session here); accounts predating it fall back to the Minecraft
    // profile name.
    const discord = getStsUserProfile(link.discord_id);
    const profile = discord ? null : await getMinecraftProfile(uuid).catch(() => null);
    const itemData = await getItemData();
    const result = createUploadedCustomItems({
        userId: link.discord_id,
        authorName: discord ? discord.name : profile ? profile.name : null,
        authorAvatar: discord ? discord.avatar : null,
        items,
        itemData,
    });
    return NextResponse.json(result);
}
