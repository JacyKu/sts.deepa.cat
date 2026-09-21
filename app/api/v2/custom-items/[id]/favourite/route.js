import { NextResponse } from 'next/server';
import {
    addCustomItemFavourite,
    removeCustomItemFavourite,
    getCustomItemFavouriteState,
    getCustomItem,
} from '../../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../../lib/session';
import { limitRequest } from '../../../../../../lib/rate-limit';

export async function GET(_request, { params }) {
    const { id } = await params;
    if (!getCustomItem(id)) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const user = await getDiscordUser();
    const state = getCustomItemFavouriteState(id, user ? user.id : null);
    return NextResponse.json({ favourite: state.favourite, count: state.count });
}

export async function POST(request, { params }) {
    const { id } = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const limited = limitRequest({
        request,
        user,
        bucket: 'favourite-custom-item',
        limit: 60,
        windowMs: 60 * 1000,
        hint: 'Too many favourite changes, slow down.',
    });
    if (limited) return limited;
    const result = addCustomItemFavourite(id, user.id);
    if (!result) {
        return NextResponse.json({ error: 'item not found' }, { status: 404 });
    }
    return NextResponse.json(result);
}

export async function DELETE(request, { params }) {
    const { id } = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const limited = limitRequest({
        request,
        user,
        bucket: 'favourite-custom-item',
        limit: 60,
        windowMs: 60 * 1000,
        hint: 'Too many favourite changes, slow down.',
    });
    if (limited) return limited;
    const result = removeCustomItemFavourite(id, user.id);
    return NextResponse.json(result || { favourite: false, count: 0 });
}
