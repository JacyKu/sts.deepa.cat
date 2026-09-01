import { NextResponse } from 'next/server';
import { createPendingLink, listLinksForDiscord, unlinkMinecraftUuid } from '../../../../../lib/sts-builds';
import { appBaseUrl, getDiscordUser } from '../../../../../lib/session';
import { getMinecraftProfile, minecraftAvatarUrl } from '../../../../../lib/minecraft-profile';

// The STS mod asks for a pending-link code for the player's Minecraft UUID.
// The returned URL is opened in the player's browser; logging in with Discord
// and confirming there (POST /api/v1/mod/link/confirm) binds the UUID to the
// account. No authentication here: the code itself is the proof of in-game
// ownership, it is single-use and expires in 15 minutes.
export async function POST(request) {
    const body = await request.json().catch(() => null);
    const uuid = typeof body?.uuid === 'string' ? body.uuid.trim() : '';
    const code = createPendingLink(uuid);
    if (!code) {
        return NextResponse.json({ error: 'invalid uuid' }, { status: 400 });
    }
    const base = appBaseUrl(request.url);
    return NextResponse.json({ url: new URL(`/link/${code}`, base).toString(), code });
}

// The signed-in user's linked Minecraft profiles (for the /account page),
// each augmented with the player's current name and head from Mojang.
export async function GET() {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const links = listLinksForDiscord(user.id);
    const augmented = await Promise.all(
        links.map(async (link) => {
            const profile = await getMinecraftProfile(link.uuid);
            return {
                ...link,
                mcName: profile ? profile.name : null,
                mcAvatar: minecraftAvatarUrl(link.uuid),
            };
        })
    );
    return NextResponse.json({ links: augmented });
}

// Disconnects a Minecraft UUID from the signed-in Discord account. Only the
// account the UUID is currently linked to may unlink it.
export async function DELETE(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid') || '';
    if (!unlinkMinecraftUuid(uuid, user.id)) {
        return NextResponse.json({ error: 'not linked to your account' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
