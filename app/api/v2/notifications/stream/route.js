import { notificationsBus } from '../../../../../lib/notifications-bus';
import { listNotifications } from '../../../../../lib/sts-builds';
import { getClientIp } from '../../../../../lib/rate-limit';

// Server-Sent Events stream for site announcements: opens with the current
// banners, then pushes a fresh list whenever the bot adds or removes one
// (see the POST/DELETE handlers in ./route.js and [id]/route.js). Clients
// use EventSource, which auto-reconnects on dropped connections.
//
// Works behind nginx because both sts location blocks set proxy_buffering
// off; X-Accel-Buffering is sent too so any other proxy skips buffering.
export const dynamic = 'force-dynamic';

// Cap concurrent streams: the request rate limiter counts requests, not held
// connections, so without this a client could hold the server open with many
// long-lived EventSource connections.
const MAX_STREAMS_GLOBAL = 500;
const MAX_STREAMS_PER_IP = 10;
let activeStreams = 0;
const streamsByIp = new Map();

export async function GET(request) {
    const ip = getClientIp(request);
    if (activeStreams >= MAX_STREAMS_GLOBAL || (streamsByIp.get(ip) || 0) >= MAX_STREAMS_PER_IP) {
        return new Response('too many concurrent connections', { status: 429 });
    }
    activeStreams += 1;
    streamsByIp.set(ip, (streamsByIp.get(ip) || 0) + 1);
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        activeStreams -= 1;
        const remaining = (streamsByIp.get(ip) || 1) - 1;
        if (remaining <= 0) streamsByIp.delete(ip);
        else streamsByIp.set(ip, remaining);
    };

    const encoder = new TextEncoder();
    let closed = false;
    const send = (payload) => {
        try {
            return controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
            return false;
        }
    };

    let controller;
    const stream = new ReadableStream({
        start(c) {
            controller = c;
        },
        cancel() {
            closed = true;
            release();
            notificationsBus.off('change', onChange);
            clearInterval(heartbeat);
        },
    });

    // The client expects a list on connect; push the current one immediately.
    send({ notifications: listNotifications() });

    const onChange = () => {
        send({ notifications: listNotifications() });
    };
    notificationsBus.on('change', onChange);

    // Keep the connection alive through idle periods and proxies.
    const heartbeat = setInterval(() => {
        if (closed) return;
        if (!send({ ping: Date.now() })) clearInterval(heartbeat);
    }, 25000);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
