import { NextResponse } from 'next/server';
import { addFavourite, removeFavourite, getFavouriteState } from '../../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../../lib/session';

export async function GET(request, { params }) {
    const p = await params;
    const user = await getDiscordUser();
    const state = getFavouriteState(p.id, user ? user.id : null);
    return NextResponse.json({ favourite: state.favourite, count: state.count });
}

export async function POST(request, { params }) {
    const p = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const result = addFavourite(p.id, user.id);
    if (!result) {
        return NextResponse.json({ error: 'build not found or not public' }, { status: 404 });
    }
    return NextResponse.json(result);
}

export async function DELETE(request, { params }) {
    const p = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const result = removeFavourite(p.id, user.id);
    return NextResponse.json(result || { favourite: false, count: 0 });
}
