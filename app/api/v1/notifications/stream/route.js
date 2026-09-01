import { notificationsBus } from '../../../../../lib/notifications-bus';
import { listNotifications } from '../../../../../lib/sts-builds';

// Server-Sent Events stream for site announcements: opens with the current
// banners, then pushes a fresh list whenever the bot adds or removes one
// (see the POST/DELETE handlers in ./route.js and [id]/route.js). Clients
// use EventSource, which auto-reconnects on dropped connections.
//
// Works behind nginx because both sts location blocks set proxy_buffering
// off; X-Accel-Buffering is sent too so any other proxy skips buffering.
export const dynamic = 'force-dynamic';

export async function GET() {
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
