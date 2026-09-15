import { NextResponse } from 'next/server';
import { deleteUserData } from '../../../../../lib/sts-builds';
import { getDiscordUser, destroySession } from '../../../../../lib/session';

// Deletes the signed-in user's site profile. Their builds keep their share
// links but leave the public database and lose the user association; the
// user's favourites, custom items and Minecraft links are removed. The
// Discord session is destroyed afterwards.
export async function POST() {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    deleteUserData(user.id);
    await destroySession();
    return NextResponse.json({ ok: true });
}
