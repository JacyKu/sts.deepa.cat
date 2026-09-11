import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeDiscordCode, getSession, discordRedirectUri, appUrl } from '../../../../../lib/session';
import { ensureStsUser } from '../../../../../lib/sts-builds';

export async function GET(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const redirectUri = discordRedirectUri(request.url);

    const cookieStore = await cookies();
    const stored = cookieStore.get('sts-oauth-state');
    let nextPath = '/builder';
    if (stored) {
        try {
            const parsed = JSON.parse(stored.value);
            if (!state || parsed.state !== state) {
                return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
            }
            nextPath = typeof parsed.next === 'string' ? parsed.next : '/builder';
        } catch (e) {
            return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
        }
    }

    if (!code) {
        return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
    }

    try {
        const user = await exchangeDiscordCode(code, redirectUri);
        const session = await getSession();
        session.user = user;
        await session.save();
        ensureStsUser(user.id, user);
        cookieStore.delete('sts-oauth-state');
        return NextResponse.redirect(appUrl(request.url, nextPath));
    } catch (e) {
        console.error('Discord OAuth callback failed:', e);
        return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
    }
}
