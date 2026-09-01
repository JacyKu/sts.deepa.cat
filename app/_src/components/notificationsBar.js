'use client';

import React from 'react';
import styles from '../styles/NotificationsBar.module.css';

// Site-wide announcements, posted by the site owner through the Discord bot
// (/notify - see apps/discord-bot). Rendered as a full-width bar under the
// top nav; the type (info/warning/error) picks the color. Updates arrive
// live over SSE (/api/v1/notifications/stream) - no page reload needed.
// Dismissal is remembered per browser (localStorage); creating/removing
// notifications only happens through the bot, never from the client.
const STORAGE_KEY = 'sts-dismissed-notifications';
const TYPE_CLASS = { info: styles.info, warning: styles.warning, error: styles.error };

function readDismissed() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
        return new Set();
    }
}

export default function NotificationsBar() {
    const [notifications, setNotifications] = React.useState(null);
    const [dismissed, setDismissed] = React.useState(null);

    React.useEffect(() => {
        // EventSource auto-reconnects on dropped connections, so the bar
        // stays live even after server restarts.
        const source = new EventSource('/api/v1/notifications/stream');
        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (Array.isArray(data.notifications)) setNotifications(data.notifications);
            } catch (e) {
                // non-JSON or ping frames; ignore
            }
        };
        return () => source.close();
    }, []);

    React.useEffect(() => {
        setDismissed(readDismissed());
    }, []);

    if (!notifications || !dismissed || notifications.length === 0) return null;

    const visible = notifications.filter((n) => !dismissed.has(n.id));
    if (visible.length === 0) return null;

    function dismiss(id) {
        const next = readDismissed();
        next.add(id);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch (e) {
            // storage unavailable; dismiss for this page view only
        }
        setDismissed(next);
    }

    return (
        <div className={styles.list}>
            {visible.map((n) => (
                <div key={n.id} className={`${styles.banner} ${TYPE_CLASS[n.type] || styles.info}`} role="status">
                    <span className={styles.message}>{n.message}</span>
                    <button type="button" className={styles.dismiss} onClick={() => dismiss(n.id)} title="Dismiss">
                        &times;
                    </button>
                </div>
            ))}
        </div>
    );
}
