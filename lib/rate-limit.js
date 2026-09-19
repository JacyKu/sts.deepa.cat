// In-memory rate limiting for the single-process deployment (pm2, one worker
// per app). Buckets are fixed-window counters keyed by an arbitrary string
// (IP, account, UUID); they reset on restart and are per-process, which is
// fine for abuse control. Daily upload limits for signed-in accounts are
// enforced from the database instead (see countRecentBuilds /
// countRecentCustomItems in lib/sts-builds.js), so they survive restarts.

const DAY_MS = 24 * 60 * 60 * 1000;

const buckets = new Map();

// Fixed-window counter: returns whether the request fits and when the window
// resets. `limit <= 0` disables the limiter.
export function consumeRateLimit(key, limit, windowMs) {
    const now = Date.now();
    if (!(limit > 0)) return { allowed: true, remaining: Infinity, resetAt: now };
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
    }
    if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }
    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function getClientIp(request) {
    const real = request.headers.get('x-real-ip');
    if (real && real.trim()) return real.trim();
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
    }
    return 'unknown';
}

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

// Read per request so .env changes only need a process restart.
export function readRateLimits() {
    return {
        apiPerMinute: Math.floor(positiveNumber(process.env.STS_API_RATE_LIMIT_PER_MINUTE, 600)),
        apiWritePerMinute: Math.floor(positiveNumber(process.env.STS_API_WRITE_RATE_LIMIT_PER_MINUTE, 60)),
        buildsPerDay: Math.floor(positiveNumber(process.env.STS_LIMIT_BUILDS_PER_DAY, 100)),
        customItemsPerDay: Math.floor(positiveNumber(process.env.STS_LIMIT_CUSTOM_ITEMS_PER_DAY, 200)),
        anonymousBuildsPerDay: Math.floor(positiveNumber(process.env.STS_LIMIT_ANONYMOUS_BUILDS_PER_DAY, 20)),
    };
}

export function dayWindowMs() {
    return DAY_MS;
}

// 429 response with Retry-After. Works in route handlers and proxy alike.
export function rateLimitResponse({ resetAt, hint, error = 'too many requests' } = {}) {
    const retryAfter = resetAt ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 3600;
    return Response.json({ error, ...(hint ? { hint } : {}) }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

// Drop expired buckets so the map cannot grow forever.
let cleanupTimer = null;
function ensureCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= now) buckets.delete(key);
        }
    }, 10 * 60 * 1000);
    cleanupTimer.unref?.();
}
ensureCleanup();
