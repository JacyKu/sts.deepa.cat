import { NextResponse } from 'next/server';
import { confirmPendingLink, getPendingLink, ensureStsUser } from '../../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../../lib/session';
import { refreshMinecraftAvatar } from '../../../../../../lib/minecraft-profile';
import { sanctionBlock } from '../../../../../../lib/moderation';

// Confirms a pending Minecraft link. Requires a signed-in Discord session: the
// confirmed UUID becomes that account's Minecraft identity. A UUID that is
// already linked to a different account is rejected - the player must unlink
// it on the site first (the confirm page links to /account).
export async function POST(request) {
    const user = await getDiscordUser();
    // Banned/suspended accounts may browse but not link new profiles.
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    // Snapshot the Discord profile so mod uploads can use the Discord name.
    ensureStsUser(user.id, user);
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code || !getPendingLink(code)) {
        return NextResponse.json({ error: 'expired' }, { status: 410 });
    }
    const result = confirmPendingLink(code, user.id);
    if (result.error === 'linked-elsewhere') {
        return NextResponse.json({ error: 'linked-elsewhere' }, { status: 409 });
    }
    if (!result.ok) {
        return NextResponse.json({ error: 'expired' }, { status: 410 });
    }
    // The UUID may have a head cached from an earlier link; a (re-)link must
    // show the account's current skin, so drop the cached copy and fetch it
    // again now. A failing render API never fails the link itself.
    try {
        await refreshMinecraftAvatar(result.uuid);
    } catch (e) {
        // keep the confirmation result even when the head cannot be refreshed
    }
    return NextResponse.json({ ok: true, uuid: result.uuid });
}
