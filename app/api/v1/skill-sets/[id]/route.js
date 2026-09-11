import { NextResponse } from 'next/server';
import { deleteSkillSet, setSkillSetPublic } from '../../../../../lib/sts-builds';
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

// Starts/stops sharing the caller's set at /builder?set=<id>. Sharing is a Discord
// login feature like saving itself; the public page needs no account.
export async function POST(request, { params }) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }
    const { id } = await params;
    const isPublic = body.public === true;
    const ok = setSkillSetPublic({
        id,
        userId: user.id,
        isPublic,
        authorName: user.globalName || user.username || null,
        authorAvatar: user.avatar || null,
    });
    if (!ok) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, public: isPublic });
}
