import { NextResponse } from 'next/server';
import {
    addCustomItemFavourite,
    removeCustomItemFavourite,
    getCustomItemFavouriteState,
    getCustomItem,
} from '../../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../../lib/session';

export async function GET(_request, { params }) {
    const { id } = await params;
    if (!getCustomItem(id)) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const user = await getDiscordUser();
    const state = getCustomItemFavouriteState(id, user ? user.id : null);
    return NextResponse.json({ favourite: state.favourite, count: state.count });
}

export async function POST(_request, { params }) {
    const { id } = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const result = addCustomItemFavourite(id, user.id);
    if (!result) {
        return NextResponse.json({ error: 'item not found' }, { status: 404 });
    }
    return NextResponse.json(result);
}

export async function DELETE(_request, { params }) {
    const { id } = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const result = removeCustomItemFavourite(id, user.id);
    return NextResponse.json(result || { favourite: false, count: 0 });
}
