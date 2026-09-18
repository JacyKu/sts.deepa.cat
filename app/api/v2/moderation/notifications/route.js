import { NextResponse } from 'next/server';
import { createNotification, listNotifications, NOTIFICATION_TYPES } from '../../../../../lib/sts-builds';
import { notificationsBus } from '../../../../../lib/notifications-bus';
import { requireModerator } from '../../../../../lib/moderation';

// Moderator-only announcements - same storage/broadcast as the bot's
// /notify command, so they appear in the site's notification bar live.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ notifications: listNotifications(50) });
}

export async function POST(request) {
    const { user, error } = await requireModerator();
    if (error) return error;
    const body = await request.json().catch(() => null);
    const message = body && typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    const type = body && NOTIFICATION_TYPES.includes(body.type) ? body.type : 'info';
    const author = user.globalName || user.username || 'Moderator';
    const notification = createNotification(message, author, type);
    notificationsBus.emit('change');
    return NextResponse.json({ notification }, { status: 201 });
}
