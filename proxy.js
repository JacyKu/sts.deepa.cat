import { NextResponse } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse, readRateLimits } from './lib/rate-limit.js';

const MINUTE_MS = 60 * 1000;

export function proxy(request) {
    const { pathname } = request.nextUrl;

    // Per-IP API rate limit: generous bucket for reads, a much smaller one
    // for writes. Per-account daily upload limits are enforced inside the
    // routes (they need the session / linked UUID).
    if (pathname.startsWith('/api/')) {
        const limits = readRateLimits();
        const isWrite = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
        const limit = isWrite ? limits.apiWritePerMinute : limits.apiPerMinute;
        const ip = getClientIp(request);
        const result = consumeRateLimit(`${isWrite ? 'api-w' : 'api-r'}:${ip}`, limit, MINUTE_MS);
        if (!result.allowed) {
            return rateLimitResponse({ resetAt: result.resetAt, hint: 'Slow down and try again shortly.' });
        }
    }

    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0].toLowerCase();

    globalThis.__deepaStsBase = hostname ? '' : '';

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next|favicon.ico).*)'],
};
