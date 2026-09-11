import { NextResponse } from 'next/server';
import { getDiscordUser, resolveProfileAvatar } from '../../../../../lib/session';
import { setAvatarSource, listLinksForDiscord } from '../../../../../lib/sts-builds';

// Saves the profile-picture preference: 'discord' (Discord avatar) or
// 'minecraft' (the cached head of the first linked Minecraft profile).
// Switching also refreshes the stored author snapshots so the user's existing
// builds and custom items show the new picture.
export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const source = body && body.source;
    if (source !== 'discord' && source !== 'minecraft') {
        return NextResponse.json({ error: 'invalid source' }, { status: 400 });
    }
    if (source === 'minecraft' && listLinksForDiscord(user.id).length === 0) {
        return NextResponse.json({ error: 'no linked minecraft profile' }, { status: 400 });
    }
    setAvatarSource(user.id, source);
    const avatar = resolveProfileAvatar(user);
    return NextResponse.json({ ok: true, avatarSource: avatar.avatarSource, avatarUrl: avatar.avatarUrl });
}
