import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../../lib/session';
import { getCustomItem, deleteCustomItem } from '../../../../../lib/sts-builds';

// Public read view: anyone with the link can look at the item, but there is
// no way to copy it into the builder or resave it (the client view is
// read-only and the item is never part of build encoding).
export async function GET(_request, { params }) {
    const { id } = await params;
    const item = getCustomItem(id);
    if (!item) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
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
