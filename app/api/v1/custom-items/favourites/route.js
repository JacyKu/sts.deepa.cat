import { NextResponse } from 'next/server';
import { listFavouriteCustomItems } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';

// The signed-in user's liked custom items (paged).
export async function GET(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const result = listFavouriteCustomItems({
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '24',
        userId: user.id,
    });
    return NextResponse.json({
        items: result.items.map((item) => ({ ...item, myFavourite: true })),
        hasMore: result.hasMore,
    });
}
