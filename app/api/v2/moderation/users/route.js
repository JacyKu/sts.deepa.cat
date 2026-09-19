import { NextResponse } from 'next/server';
import { listModerationUsers } from '../../../../../lib/sts-builds';
import { requireModerator } from '../../../../../lib/moderation';

// Moderator-only account search: /api/v2/moderation/users?q=&limit=
export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { error } = await requireModerator();
    if (error) return error;
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const limit = url.searchParams.get('limit');
    return NextResponse.json({ users: listModerationUsers({ query, limit }) });
}
