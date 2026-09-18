import { NextResponse } from 'next/server';
import { getModerationUser } from '../../../../../../lib/sts-builds';
import { requireModerator } from '../../../../../../lib/moderation';

// Moderator-only account detail: profile, links, content counts, sanction.
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
    const { error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    const user = getModerationUser(id);
    if (!user) {
        return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }
    return NextResponse.json({ user });
}
