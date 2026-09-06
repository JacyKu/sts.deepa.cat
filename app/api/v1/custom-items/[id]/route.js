import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../../lib/session';
import { getCustomItem, deleteCustomItem, updateCustomItem, hasCustomItemName } from '../../../../../lib/sts-builds';

// Custom items are private to their creator: the item is only ever served to
// the owner (404 for everyone else, so the link reveals nothing).
export async function GET(_request, { params }) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const { id } = await params;
    const item = getCustomItem(id);
    if (!item || item.userId !== user.id) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
}

export async function PATCH(request, { params }) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const item = getCustomItem(id);
    if (!item) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    if (item.userId !== user.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const update = {};
    if (body && typeof body.name === 'string') {
        const name = body.name.trim();
        if (!name) {
            return NextResponse.json({ error: 'invalid name' }, { status: 400 });
        }
        if (name.length > 64) {
            return NextResponse.json({ error: 'name too long' }, { status: 400 });
        }
        // Another of the user's items already uses this name (this one's own
        // name is exempt - keeping it unchanged is fine).
        if (hasCustomItemName(user.id, name, id)) {
            return NextResponse.json({ error: 'duplicate' }, { status: 409 });
        }
        update.name = name;
    }
    if (body && body.type !== undefined) {
        update.type = typeof body.type === 'string' && body.type.length <= 32 ? body.type : 'Miscellaneous';
    }
    if (body && body.textureToken !== undefined) {
        const textureToken = typeof body.textureToken === 'string' ? body.textureToken : '';
        if (!textureToken || textureToken.length > 64 || !/^[a-z0-9_]+$/.test(textureToken)) {
            return NextResponse.json({ error: 'invalid texture' }, { status: 400 });
        }
        update.textureToken = textureToken;
    }
    if (body && body.textureName !== undefined) {
        update.textureName =
            typeof body.textureName === 'string' && body.textureName.length <= 128 ? body.textureName : null;
    }
    if (body && body.stats !== undefined) {
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
        update.stats = stats;
    }

    const updated = updateCustomItem(id, user.id, update);
    if (!updated) {
        return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }
    return NextResponse.json({ item: updated });
}

export async function DELETE(_request, { params }) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const item = getCustomItem(id);
    if (!item) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    if (item.userId !== user.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    deleteCustomItem(id, user.id);
    return NextResponse.json({ ok: true });
}
