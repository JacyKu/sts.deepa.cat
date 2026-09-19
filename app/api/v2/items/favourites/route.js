import { NextResponse } from 'next/server';
import { listItemFavourites } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';

// The signed-in user's favourited item names (base names). Empty list when
// logged out - the client uses `authenticated` to decide whether to show the
// favourite buttons at all.
export async function GET() {
    const user = await getDiscordUser();
    return NextResponse.json({
        favourites: listItemFavourites(user ? user.id : null),
        authenticated: Boolean(user),
    });
}
