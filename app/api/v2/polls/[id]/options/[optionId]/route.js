import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../../../../lib/session';
import { deleteOwnPollOption } from '../../../../../../../lib/polls';
import { limitRequest } from '../../../../../../../lib/rate-limit';
import { sanctionBlock } from '../../../../../../../lib/moderation';

// DELETE /api/v2/polls/<id>/options/<optionId> -> { poll }
//
// Withdraws the caller's own suggested name (the page puts a confirm step in
// front of it). Deleting frees the one-suggestion slot so a replacement can be
// added; other users' options (and seed options) cannot be touched here.
export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
    const user = await getDiscordUser();
    if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;

    const limited = limitRequest({
        request,
        user,
        bucket: 'poll-delete-option',
        limit: 20,
        windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const p = await params;
    const result = deleteOwnPollOption(Number(p.id), Number(p.optionId), user.id);
    if (result.error) {
        const status =
            result.error === 'not-found'
                ? 404
                : result.error === 'forbidden'
                  ? 403
                  : result.error === 'closed'
                    ? 409
                    : 400;
        return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ poll: result.poll });
}
