import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { listNotifications, createNotification, NOTIFICATION_TYPES } from '../../../../lib/sts-builds';
import { notificationsBus } from '../../../../lib/notifications-bus';

// Site announcements.
//   GET  /api/v1/notifications        -> { notifications } (public)
//   POST /api/v1/notifications        -> { notification } (bot only)
//
// The Discord bot posts announcements from its owner-only /notify command;
// only the holder of the shared secret (STS_BOT_API_KEY, same value set on
// the bot server) may write. Clients can read but never write or delete -
// removal goes through the bot too (DELETE /api/v1/notifications/<id>).
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ notifications: listNotifications() });
}

export async function POST(request) {
    const expected = process.env.STS_BOT_API_KEY;
    if (!expected) {
        return NextResponse.json({ error: 'not configured' }, { status: 503 });
    }
    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!auth || !timingSafeEqualStr(auth, expected)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const message = body && typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    const author = body && typeof body.author === 'string' ? body.author.trim().slice(0, 100) : null;
    const type = body && NOTIFICATION_TYPES.includes(body.type) ? body.type : 'info';
    const notification = createNotification(message, author, type);
    // Broadcast the fresh list to open SSE clients (/notifications/stream).
    notificationsBus.emit('change');
    return NextResponse.json({ notification }, { status: 201 });
}

function timingSafeEqualStr(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
