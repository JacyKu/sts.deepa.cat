import { NextResponse } from 'next/server';
import { getMinecraftAvatar, minecraftAvatarRemoteUrl } from '../../../../../lib/minecraft-profile';

// Serves Minecraft head avatars from the server-side cache (memory +
// data/avatars). The first request per UUID fetches the render from
// mc-heads.net; later requests are served locally. When the upstream is
// unreachable and nothing cached, redirect to mc-heads so the image can
// still load in the browser.
export const runtime = 'nodejs';

export async function GET(_request, { params }) {
    const { uuid } = await params;
    const avatar = await getMinecraftAvatar(uuid);
    if (!avatar) {
        const remote = minecraftAvatarRemoteUrl(uuid);
        if (remote) return NextResponse.redirect(remote, { status: 302 });
        return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(avatar.buffer, {
        headers: {
            'Content-Type': avatar.contentType,
            'Content-Length': String(avatar.buffer.length),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
    });
}
