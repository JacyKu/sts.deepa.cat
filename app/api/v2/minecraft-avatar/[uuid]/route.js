import { NextResponse } from 'next/server';
import { getMinecraftAvatar } from '../../../../../lib/minecraft-profile';

// Serves Minecraft head avatars from our own cache (memory + the site
// database). The first request for a UUID renders the head from mc-heads.net
// once and stores it; every later request is served locally. Nothing is ever
// hotlinked to the upstream site, so the images load the same on every device
// - when the upstream is unreachable and the UUID has never been fetched, a
// 404 is returned instead of redirecting the visitor to mc-heads.
export const runtime = 'nodejs';

export async function GET(_request, { params }) {
    const { uuid } = await params;
    const avatar = await getMinecraftAvatar(uuid);
    if (!avatar) {
        return new NextResponse('Not found', {
            status: 404,
            // Do not let the browser cache the miss: once the head has been
            // fetched (or the upstream recovers) the next request succeeds.
            headers: { 'Cache-Control': 'no-store' },
        });
    }
    return new NextResponse(avatar.buffer, {
        headers: {
            'Content-Type': avatar.contentType,
            'X-Content-Type-Options': 'nosniff',
            'Content-Length': String(avatar.buffer.length),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
    });
}
