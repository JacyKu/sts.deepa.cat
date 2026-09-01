import { NextResponse } from 'next/server';
import { confirmPendingLink, getPendingLink } from '../../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../../lib/session';

// Confirms a pending Minecraft link. Requires a signed-in Discord session: the
// confirmed UUID becomes that account's Minecraft identity. A UUID that is
// already linked to a different account is rejected - the player must unlink
// it on the site first (the confirm page links to /account).
export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code || !getPendingLink(code)) {
        return NextResponse.json({ error: 'expired' }, { status: 410 });
    }
    const result = confirmPendingLink(code, user.id);
    if (result.error === 'linked-elsewhere') {
        return NextResponse.json({ error: 'linked-elsewhere' }, { status: 409 });
    }
    if (!result.ok) {
        return NextResponse.json({ error: 'expired' }, { status: 410 });
    }
    return NextResponse.json({ ok: true, uuid: result.uuid });
}
