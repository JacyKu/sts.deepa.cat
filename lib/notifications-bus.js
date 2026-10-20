import { EventEmitter } from 'node:events';

// In-process event bus for site announcements. The API routes emit 'change'
// after creating/deleting a notification; the SSE stream route
// (/api/v2/notifications/stream) subscribes and pushes live updates to open
// clients. Single-process deployments only (one `next start` instance per
// app) - that's the setup here (pm2, one worker each).
export const notificationsBus = new EventEmitter();

// One 'change' listener per open SSE stream (removed again when the client
// disconnects), so the limit is really just the number of concurrent viewers:
// Node's default of 10 warns at the eleventh, which the stream route already
// caps properly (500 connections, 10 per IP). That cap is the bound, not this.
notificationsBus.setMaxListeners(0);
