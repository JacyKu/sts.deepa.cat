import { NextResponse } from 'next/server';
import { requireModerator } from '../../../../../lib/moderation';
import { createPoll, listPolls, listRecentRuns, POLL_TITLE_MAX } from '../../../../../lib/polls';
import { hasBadWords } from '../../../../../lib/public-builds';
import { limitRequest } from '../../../../../lib/rate-limit';

// Moderator management of update-name polls.
//   GET  /api/v2/moderation/polls -> { polls, runs }
//   POST /api/v2/moderation/polls -> { poll } (create)
//
// `runs` lists the most recent recorded class/API update runs so the moderator
// can attach the poll to the run it names; when the poll is closed, the
// winning option's name is shown as that run's title on the changes pages.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ polls: listPolls({ withVoters: true }), runs: listRecentRuns() });
}

export async function POST(request) {
    const { user, error } = await requireModerator();
    if (error) return error;

    const limited = limitRequest({
        request,
        user,
        bucket: 'poll-create',
        limit: 20,
        windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    // Same profanity filter as user suggestions: no path may introduce a slur,
    // whether through the poll title or the starter options.
    const title = body && typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > POLL_TITLE_MAX) {
        return NextResponse.json({ error: `the title must be 1-${POLL_TITLE_MAX} characters` }, { status: 400 });
    }
    if (hasBadWords(title)) {
        return NextResponse.json({ error: 'please keep the poll name clean' }, { status: 400 });
    }
    const options = Array.isArray(body && body.options) ? body.options : [];
    if (options.some((name) => hasBadWords(String(name || '')))) {
        return NextResponse.json({ error: 'please keep the option names clean' }, { status: 400 });
    }

    const result = createPoll({
        title: body && body.title,
        kind: body && body.kind,
        runAt: body && body.runAt,
        options: body && body.options,
        createdBy: user.id,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ poll: result.poll }, { status: 201 });
}
