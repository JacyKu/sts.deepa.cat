import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../../../lib/session';
import { votePoll } from '../../../../../../lib/polls';
import { limitRequest } from '../../../../../../lib/rate-limit';
import { sanctionBlock } from '../../../../../../lib/moderation';

// POST /api/v2/polls/<id>/vote { optionId } -> { poll }
//
// One vote per user per poll: voting again moves the vote. Signed in with
// Discord, so an account (not an IP) is the unit the spam rules apply to.
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
    const user = await getDiscordUser();
    if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;

    const limited = limitRequest({
        request,
        user,
        bucket: 'poll-vote',
        limit: 60,
        windowMs: 60 * 1000,
        hint: 'Slow down a little before voting again.',
    });
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const optionId = body ? Number(body.optionId) : NaN;
    if (!Number.isInteger(optionId) || optionId <= 0) {
        return NextResponse.json({ error: 'optionId is required' }, { status: 400 });
    }

    const p = await params;
    const result = votePoll(Number(p.id), optionId, user.id);
    if (result.error) {
        const status = result.error === 'not-found' ? 404 : result.error === 'invalid-option' ? 400 : 409;
        return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ poll: result.poll });
}
