import { NextResponse } from 'next/server';
import { deleteNotification } from '../../../../../../lib/sts-builds';
import { notificationsBus } from '../../../../../../lib/notifications-bus';
import { requireModerator } from '../../../../../../lib/moderation';

// Moderator-only announcement removal (the bot flow keeps its own endpoint).
export const dynamic = 'force-dynamic';

export async function DELETE(_request, { params }) {
    const { error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }
    const ok = deleteNotification(numeric);
    notificationsBus.emit('change');
    return NextResponse.json({ ok });
}
