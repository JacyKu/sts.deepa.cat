import { NextResponse } from 'next/server';
import { getDiscordUser } from '../../../../lib/session';
import { listPolls } from '../../../../lib/polls';

// Community update-name polls.
//   GET /api/v2/polls -> { polls, viewer }
//
// Public read: everyone sees the polls, options and live counts; `viewer` and
// each option's `mine` flag are only filled for signed-in users so the page
// can highlight their vote. Voting and suggesting go through the two POST
// routes below.
export const dynamic = 'force-dynamic';

export async function GET() {
    const user = await getDiscordUser();
    return NextResponse.json({
        polls: listPolls({ userId: user ? user.id : null }),
        viewer: user ? { id: user.id, name: user.globalName || user.username || user.id } : null,
    });
}
