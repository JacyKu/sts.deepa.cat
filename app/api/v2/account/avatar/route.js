import { NextResponse } from 'next/server';
import { getDiscordUser, resolveProfileAvatar } from '../../../../../lib/session';
import { sanctionBlock } from '../../../../../lib/moderation';
import { setAvatarSource, listLinksForDiscord } from '../../../../../lib/sts-builds';

// Saves the profile-picture preference: 'discord' (Discord avatar),
// 'minecraft' (the cached head of the first linked Minecraft profile) or
// 'upload:<id>' (one of the account's uploaded pictures). Switching also
// refreshes the stored author snapshots so the user's existing builds and
// custom items show the new picture.
export async function POST(request) {
    const user = await getDiscordUser();
    // Banned/suspended accounts may browse but not change their picture.
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const source = body && body.source;
    const isUpload = typeof source === 'string' && source.startsWith('upload:');
    if (source !== 'discord' && source !== 'minecraft' && !isUpload) {
        return NextResponse.json({ error: 'invalid source' }, { status: 400 });
    }
    if (source === 'minecraft' && listLinksForDiscord(user.id).length === 0) {
        return NextResponse.json({ error: 'no linked minecraft profile' }, { status: 400 });
    }
    // setAvatarSource validates that an upload belongs to this account.
    if (!setAvatarSource(user.id, source)) {
        return NextResponse.json({ error: 'invalid source' }, { status: 400 });
    }
    const avatar = resolveProfileAvatar(user);
    return NextResponse.json({
        ok: true,
        avatarSource: avatar.avatarSource,
        avatarUrl: avatar.avatarUrl,
        uploadedAvatars: avatar.uploadedAvatars,
    });
}
