import { NextResponse } from 'next/server';
import { listModerationBuilds } from '../../../../../lib/sts-builds';
import { requireModerator } from '../../../../../lib/moderation';

// Moderator-only build search: /api/v2/moderation/builds?q=&limit=
export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { error } = await requireModerator();
    if (error) return error;
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const limit = url.searchParams.get('limit');
    return NextResponse.json({ builds: listModerationBuilds({ query, limit }) });
}
