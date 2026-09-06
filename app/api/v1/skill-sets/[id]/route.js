import { NextResponse } from 'next/server';
import { deleteSkillSet } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';

// Deletes one of the caller's saved skill/delve sets. Only the owner can
// delete; nobody can read or write someone else's sets.
export async function DELETE(_request, { params }) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const deleted = deleteSkillSet(id, user.id);
    if (!deleted) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
