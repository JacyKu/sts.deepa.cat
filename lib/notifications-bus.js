import { EventEmitter } from 'node:events';

// In-process event bus for site announcements. The API routes emit 'change'
// after creating/deleting a notification; the SSE stream route
// (/api/v1/notifications/stream) subscribes and pushes live updates to open
// clients. Single-process deployments only (one `next start` instance per
// app) - that's the setup here (pm2, one worker each).
export const notificationsBus = new EventEmitter();
