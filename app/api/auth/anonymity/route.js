import { NextResponse } from 'next/server';
import { requireDiscordUser, setAnonymousPreference } from '../../../../lib/session';

export async function POST(request) {
    const user = await requireDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const anonymous = Boolean(body && body.anonymous);
    await setAnonymousPreference(anonymous);
    return NextResponse.json({ ok: true, anonymous });
}
