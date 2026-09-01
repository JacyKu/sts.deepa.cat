import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { deleteNotification } from '../../../../../lib/sts-builds';
import { notificationsBus } from '../../../../../lib/notifications-bus';

// Removes a site announcement. Bot only - the site owner deletes through the
// Discord bot's owner-only commands, never from the client side.
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
    const p = await params;
    const expected = process.env.STS_BOT_API_KEY;
    if (!expected) {
        return NextResponse.json({ error: 'not configured' }, { status: 503 });
    }
    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!auth || !timingSafeEqualStr(auth, expected)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const id = Number(p.id);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }
    const ok = deleteNotification(id);
    // Broadcast the fresh list to open SSE clients (/notifications/stream).
    notificationsBus.emit('change');
    return NextResponse.json({ ok });
}

function timingSafeEqualStr(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
