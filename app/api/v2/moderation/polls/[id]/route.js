import { NextResponse } from 'next/server';
import { requireModerator } from '../../../../../../lib/moderation';
import { closePoll, deletePoll, reopenPoll, removePollOption } from '../../../../../../lib/polls';

// PATCH /api/v2/moderation/polls/<id> { action, ... } -> { poll } | { ok }
//
//   close        { winnerOptionId? } - closes the poll; without a winner the
//                                      top-voted option wins
//   reopen       - reopens voting (the stored winner stops labelling the run)
//   removeOption { optionId }        - deletes a spam option and its votes
//   delete       - removes the poll entirely
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
    const { error } = await requireModerator();
    if (error) return error;

    const body = await request.json().catch(() => null);
    const action = body && body.action;
    const p = await params;
    const id = Number(p.id);

    let result;
    if (action === 'close') {
        result = closePoll(id, body && body.winnerOptionId != null ? Number(body.winnerOptionId) : null);
    } else if (action === 'reopen') {
        result = reopenPoll(id);
    } else if (action === 'removeOption') {
        result = removePollOption(id, body && body.optionId);
    } else if (action === 'delete') {
        result = deletePoll(id);
    } else {
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    if (result.error) {
        const status = result.error === 'not-found' ? 404 : result.error === 'invalid-option' ? 400 : 409;
        return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
}
