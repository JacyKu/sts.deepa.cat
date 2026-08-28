import { NextResponse } from 'next/server';
import { addItemFavourite, removeItemFavourite } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';

// Toggle a single item favourite. Item names may contain spaces and other
// characters that are awkward in URL segments, so the name travels in the
// request body (POST) or query string (DELETE).
export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    let name = null;
    try {
        name = String((await request.json()).name || '');
    } catch (e) {
        name = '';
    }
    if (!name) {
        return NextResponse.json({ error: 'missing name' }, { status: 400 });
    }
    addItemFavourite(name, user.id);
    return NextResponse.json({ favourite: true });
}

export async function DELETE(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const name = new URL(request.url).searchParams.get('name');
    if (!name) {
        return NextResponse.json({ error: 'missing name' }, { status: 400 });
    }
    removeItemFavourite(name, user.id);
    return NextResponse.json({ favourite: false });
}
