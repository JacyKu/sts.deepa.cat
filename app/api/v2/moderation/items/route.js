import { NextResponse } from 'next/server';
import { getItemUpdateStatus, startItemUpdate } from '../../../../../lib/item-update-scheduler';
import { limitRequest } from '../../../../../lib/rate-limit';
import { requireModerator } from '../../../../../lib/moderation';

// Moderator-triggered item data refresh: the same run the weekly scheduler
// performs (fetch items/skills from the Monumenta API, rewrite public/items).
// Only one run happens at a time; the moderation panel polls GET for progress
// and the last run's result/output.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ status: getItemUpdateStatus() });
}

export async function POST(request) {
    const { user, error } = await requireModerator();
    if (error) return error;

    // The data only changes weekly, so a handful of manual refreshes per
    // window is plenty; the run lock below stops overlapping runs anyway.
    const limited = limitRequest({
        request,
        user,
        bucket: 'items-update',
        limit: 5,
        windowMs: 10 * 60 * 1000,
        hint: 'The item data changes at most weekly; wait a few minutes before refreshing again.',
    });
    if (limited) return limited;

    const actor = user.globalName || user.username || user.id;
    if (!startItemUpdate({ actor })) {
        return NextResponse.json(
            { error: 'an item update is already running', status: getItemUpdateStatus() },
            { status: 409 }
        );
    }
    return NextResponse.json({ status: getItemUpdateStatus() }, { status: 202 });
}
