import { NextResponse } from 'next/server';
import { getDiscordUser, resolveProfileAvatar } from '../../../../../../lib/session';
import { getUserAvatar, deleteUserAvatar } from '../../../../../../lib/sts-builds';

// Serves an uploaded profile picture. Public: the picture appears on public
// build cards, so anyone with the URL may fetch it. The stored mime is always
// one of the sniffed image types, and ids are random, so responses are
// immutable-cacheable.
export async function GET(_request, { params }) {
    const { id } = await params;
    const row = getUserAvatar(id);
    if (!row) {
        return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(row.data), {
        headers: {
            'Content-Type': row.mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

// Remove one of the account's uploaded pictures. If it was the active one,
// the account falls back to its Discord avatar.
export async function DELETE(_request, { params }) {
    const { id } = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (!deleteUserAvatar(id, user.id)) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const avatar = resolveProfileAvatar(user);
    return NextResponse.json({
        ok: true,
        avatarSource: avatar.avatarSource,
        avatarUrl: avatar.avatarUrl,
        uploadedAvatars: avatar.uploadedAvatars,
    });
}
