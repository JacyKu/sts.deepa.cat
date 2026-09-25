import { NextResponse } from 'next/server';
import { getClassUpdateStatus, startClassUpdate } from '../../../../../lib/class-update-scheduler';
import { limitRequest } from '../../../../../lib/rate-limit';
import { requireModerator } from '../../../../../lib/moderation';

// Moderator-triggered class data refresh: fetch the live classes/skills/specs
// from the Monumenta API, archive the differences and rewrite
// public/items/skills.json (+ class-history.json). Only one run happens at a
// time; the moderation panel polls GET for progress and the last run's
// output.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ status: getClassUpdateStatus() });
}

export async function POST(request) {
    const { user, error } = await requireModerator();
    if (error) return error;

    // Class data changes at most on game updates, so a handful of manual
    // refreshes per window is plenty; the run lock below stops overlapping
    // runs anyway.
    const limited = limitRequest({
        request,
        user,
        bucket: 'classes-update',
        limit: 5,
        windowMs: 10 * 60 * 1000,
        hint: 'Class data changes rarely; wait a few minutes before refreshing again.',
    });
    if (limited) return limited;

    const actor = user.globalName || user.username || user.id;
    if (!startClassUpdate({ actor })) {
        return NextResponse.json(
            { error: 'a class update is already running', status: getClassUpdateStatus() },
            { status: 409 }
        );
    }
    return NextResponse.json({ status: getClassUpdateStatus() }, { status: 202 });
}
