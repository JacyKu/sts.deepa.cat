import { NextResponse } from 'next/server';
import { requireDiscordUser, setAnonymousPreference } from '../../../../lib/session';
import { sanctionBlock } from '../../../../lib/moderation';

export async function POST(request) {
    const user = await requireDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;
    const body = await request.json().catch(() => null);
    const anonymous = Boolean(body && body.anonymous);
    await setAnonymousPreference(anonymous);
    return NextResponse.json({ ok: true, anonymous });
}
