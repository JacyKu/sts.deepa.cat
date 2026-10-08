import { NextResponse } from 'next/server';
import { requireModerator } from '../../../../../lib/moderation';
import { listUpdateRuns, changeUpdateRunDate } from '../../../../../lib/update-runs';
import { limitRequest } from '../../../../../lib/rate-limit';

// Moderator correction of recorded API update dates.
//   GET   /api/v2/moderation/update-runs -> { runs }
//   PATCH /api/v2/moderation/update-runs { at, newAt } -> { run, runs }
//
// Renames the run's entry date; the archived item records (and any name poll
// attached to the run) are re-stamped to match.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ runs: listUpdateRuns() });
}

export async function PATCH(request) {
    const { user, error } = await requireModerator();
    if (error) return error;

    const limited = limitRequest({
        request,
        user,
        bucket: 'update-run-date',
        limit: 20,
        windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const result = changeUpdateRunDate(body && body.at, body && body.newAt);
    if (result.unchanged) return NextResponse.json({ ok: true, unchanged: true });
    if (result.error) {
        const status = result.error === 'not-found' ? 404 : 400;
        const messages = {
            'invalid-date': 'that does not look like a valid date',
            'duplicate-date': 'another update already uses that date',
            unavailable: 'the update history is unavailable',
            'write-failed': 'the update history could not be written',
        };
        return NextResponse.json({ error: messages[result.error] || result.error }, { status });
    }
    return NextResponse.json({ run: result.history, runs: listUpdateRuns() });
}
