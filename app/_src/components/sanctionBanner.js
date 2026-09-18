'use client';

import React from 'react';
import styles from '../styles/NotificationsBar.module.css';
import { useSessionState } from './header';
import { useTranslation } from './useTranslation';
import { formatDateString } from '../utils/dateFormat';

// Persistent notice shown to banned/suspended accounts. The API refuses their
// writes; this explains why and until when. Rendered under the notification
// bar, in the same banner style, without a dismiss button.
export default function SanctionBanner() {
    const session = useSessionState();
    const t = useTranslation();
    const sanction = session.user ? session.user.sanction : null;
    if (!sanction) return null;

    const banned = sanction.kind === 'ban';
    const until = sanction.expiresAt
        ? formatDateString(sanction.expiresAt, { spaceToT: true, includeTime: true })
        : null;

    return (
        <div className={styles.list}>
            <div className={`${styles.banner} ${banned ? styles.error : styles.warning}`} role="alert">
                <span className={styles.message}>
                    <strong>{banned ? t('moderation.banner.banned') : t('moderation.banner.suspended')}</strong>
                    {sanction.reason ? ` - ${sanction.reason}` : ''}
                    {until ? ` - ${t('moderation.banner.until')} ${until} UTC` : ''}
                </span>
            </div>
        </div>
    );
}
