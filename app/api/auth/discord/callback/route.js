import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
    exchangeDiscordCode,
    getSession,
    discordRedirectUri,
    appUrl,
    safeRedirectPath,
} from '../../../../../lib/session';
import { ensureStsUser } from '../../../../../lib/sts-builds';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '../../../../../lib/rate-limit';

export async function GET(request) {
    const quota = consumeRateLimit(`oauth-callback:${getClientIp(request)}`, 30, 5 * 60 * 1000);
    if (!quota.allowed) {
        return rateLimitResponse({ resetAt: quota.resetAt, hint: 'Too many login attempts, try again later.' });
    }
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const redirectUri = discordRedirectUri(request.url);

    // The state cookie is required: without it the callback could be triggered
    // cross-site with an attacker's OAuth code (login CSRF), binding the
    // victim's browser session to the attacker's Discord account.
    const cookieStore = await cookies();
    const stored = cookieStore.get('sts-oauth-state');
    if (!stored) {
        return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
    }
    let nextPath = '/builder';
    try {
        const parsed = JSON.parse(stored.value);
        if (!state || parsed.state !== state) {
            return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
        }
        nextPath = safeRedirectPath(parsed.next);
    } catch (e) {
        return NextResponse.redirect(appUrl(request.url, '/builder?login=failed'));
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
