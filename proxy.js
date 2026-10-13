import { NextResponse } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse, readRateLimits } from './lib/rate-limit.js';

const MINUTE_MS = 60 * 1000;

export function proxy(request) {
    const { pathname } = request.nextUrl;

    // Legacy /sts prefix: the app lives at the route root now, but old links
    // and stale client bundles still request sts.deepa.cat/sts/... (including
    // RSC prefetches). Redirect to the same route without the prefix, keeping
    // the query so prefetches still get their payload.
    if (pathname === '/sts' || pathname.startsWith('/sts/')) {
        // The query is preserved (minus the internal ?_rsc, which Next strips
        // on both sides; the RSC payload is driven by the RSC header).
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice('/sts'.length) || '/';
        return NextResponse.redirect(url);
    }

    // CSRF defence in depth for state-changing API calls. SameSite=Lax already
    // keeps the session cookie off cross-site POSTs, but a same-site sibling
    // origin (or a browser that ignores SameSite) could still ride it. Reject a
    // write whose Origin is present and not this site; native clients (the mod
    // and bot) send no Origin, so they are unaffected.
    if (pathname.startsWith('/api/')) {
        const method = request.method;
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const origin = request.headers.get('origin');
            const pinned = process.env.STS_PUBLIC_BASE_URL ? new URL(process.env.STS_PUBLIC_BASE_URL).origin : null;
            if (origin && origin !== request.nextUrl.origin && origin !== pinned) {
                return NextResponse.json({ error: 'cross-origin request blocked' }, { status: 403 });
            }
        }
    }

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
