import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../../../lib/session';
import { addPollOption, POLL_NAME_MAX, POLL_NAME_MIN } from '../../../../../../lib/polls';
import { hasBadWords } from '../../../../../../lib/public-builds';
import { limitRequest } from '../../../../../../lib/rate-limit';
import { sanctionBlock } from '../../../../../../lib/moderation';

// POST /api/v2/polls/<id>/options { name } -> { poll }
//
// "Add your own name" on an open poll. One suggestion per user, unique names
// per poll, length-capped and profanity-checked - the structured equivalent
// of shouting a name into the Discord chat, without the spam.
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
    const user = await getDiscordUser();
    if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;

    const limited = limitRequest({
        request,
        user,
        bucket: 'poll-suggest',
        limit: 5,
        windowMs: 10 * 60 * 1000,
        hint: 'You can only add a few name ideas; try again later.',
    });
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const raw = body && typeof body.name === 'string' ? body.name.trim() : '';
    if (raw.length < POLL_NAME_MIN || raw.length > POLL_NAME_MAX) {
        return NextResponse.json(
            { error: `the name must be ${POLL_NAME_MIN}-${POLL_NAME_MAX} characters` },
            { status: 400 }
        );
    }
    if (hasBadWords(raw)) {
        return NextResponse.json({ error: 'please keep the name clean' }, { status: 400 });
    }

    const p = await params;
    const result = addPollOption(Number(p.id), raw, user.id);
    if (result.error) {
        const messages = {
            'not-found': 'poll not found',
            closed: 'this poll is closed',
            'invalid-name': `the name must be ${POLL_NAME_MIN}-${POLL_NAME_MAX} characters`,
            duplicate: 'that name is already an option',
            'already-suggested': 'you already added a name to this poll',
        };
        const status = result.error === 'not-found' ? 404 : result.error === 'closed' ? 409 : 400;
        return NextResponse.json({ error: messages[result.error] || result.error }, { status });
    }
    return NextResponse.json({ poll: result.poll }, { status: 201 });
}
