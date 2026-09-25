import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { discordLoginUrl, discordRedirectUri, safeRedirectPath } from '../../../../../lib/session';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '../../../../../lib/rate-limit';

export async function GET(request) {
    const quota = consumeRateLimit(`oauth-login:${getClientIp(request)}`, 30, 5 * 60 * 1000);
    if (!quota.allowed) {
        return rateLimitResponse({ resetAt: quota.resetAt, hint: 'Too many login attempts, try again later.' });
    }
    const nextPath = safeRedirectPath(new URL(request.url).searchParams.get('next'));
    const state = crypto.randomBytes(16).toString('hex');

    (await cookies()).set('sts-oauth-state', JSON.stringify({ state, next: nextPath }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 10,
        path: '/',
    });

    const url = discordLoginUrl(state, discordRedirectUri(request.url));
    return NextResponse.redirect(url);
}
