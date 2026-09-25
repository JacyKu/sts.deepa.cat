'use client';

import React from 'react';
import styles from '../styles/Account.module.css';
import { useTranslation } from './useTranslation';

// Confirmation page for the /sts link flow: the player ran the command in
// game, got a temp link, and landed here. If they're not logged in yet they
// log in with Discord first (the login flow returns them to this page), then
// confirm - which binds their Minecraft UUID to their Discord account.
export default function LinkConfirmPage({ code, pending, user, profile }) {
    const t = useTranslation();
    const [state, setState] = React.useState('idle');
    const [error, setError] = React.useState(null);
    const [replaceInfo, setReplaceInfo] = React.useState(null);

    const next = `/link/${code}`;

    function confirm(replace = false) {
        setState('working');
        setError(null);
        fetch('/api/v2/mod/link/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, replace }),
        })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject({ status: r.status, body }))))
            .then(() => setState('done'))
            .catch((e) => {
                if (e.status === 409 && e.body?.error === 'replace-required') {
                    setReplaceInfo({
                        requestedFrom: e.body.requestedFrom || null,
                        requestedAt: e.body.requestedAt || null,
                    });
                    setState('confirm-replace');
                } else if (e.status === 409) {
                    setError('auth.linkConfirm.alreadyLinked');
                    setState('idle');
                } else {
                    setError('auth.linkConfirm.invalid');
                    setState('idle');
                }
            });
    }

    if (!pending) {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>{t('auth.linkConfirm.title')}</h1>
                <p className={styles.muted}>{t('auth.linkConfirm.invalid')}</p>
            </main>
        );
    }

    const requestedAt = pending.created_at ? new Date(`${pending.created_at}Z`.replace(' ', 'T')) : null;
    const requestedLabel =
        pending.request_ip || requestedAt
            ? [pending.request_ip, requestedAt && !Number.isNaN(requestedAt.getTime()) ? requestedAt.toLocaleString() : null]
                  .filter(Boolean)
                  .join(' · ')
            : null;

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>{t('auth.linkConfirm.title')}</h1>
            <section className={styles.card}>
                <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('auth.linkConfirm.minecraftProfile')}</span>
                    {profile && profile.avatarUrl && (
                        <img className={styles.mcAvatar} src={profile.avatarUrl} alt="" width="32" height="32" />
                    )}
                    <code className={styles.uuid}>{profile && profile.name ? profile.name : pending.uuid}</code>
                    {profile && profile.name && <span className={styles.uuidMuted}>({pending.uuid})</span>}
                </div>
                {user && (
                    <div className={styles.row}>
                        <span className={styles.rowLabel}>{t('auth.linkConfirm.discordAccount')}</span>
                        <span className={styles.rowValue}>{user.globalName || user.username}</span>
                    </div>
                )}
                {requestedLabel && (
                    <div className={styles.row}>
                        <span className={styles.rowLabel}>{t('auth.linkConfirm.requestedFrom')}</span>
                        <span className={styles.rowValue}>{requestedLabel}</span>
                    </div>
                )}

                {state === 'done' ? (
                    <p className={styles.success}>
                        {t('auth.linkConfirm.linked')}{' '}
                        <a className={styles.loginLink} href="/account">
                            {t('auth.linkConfirm.manageLinkedProfiles')}
                        </a>
                    </p>
                ) : !user ? (
                    <p className={styles.muted}>
                        <a
                            className={styles.loginLink}
                            href={`/api/auth/discord/login?next=${encodeURIComponent(next)}`}
                        >
                            {t('auth.loginWithDiscord')}
                        </a>{' '}
                        {t('auth.linkConfirm.confirmOwnership')}
                    </p>
                ) : state === 'confirm-replace' ? (
                    <div>
                        <p className={styles.error}>
                            {t('auth.linkConfirm.replaceWarning')}
                            {replaceInfo?.requestedFrom ? ` (${replaceInfo.requestedFrom})` : ''}
                        </p>
                        <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={() => confirm(true)}
                            disabled={state === 'working'}
                        >
                            {t('auth.linkConfirm.replaceDevice')}
                        </button>
                    </div>
                ) : (
                    <div>
                        {error && (
                            <p className={styles.error}>
                                {t(error)}{' '}
                                {error === 'auth.linkConfirm.alreadyLinked' && (
                                    <a className={styles.loginLink} href="/account">
                                        {t('auth.linkConfirm.manageProfiles')}
                                    </a>
                                )}
                            </p>
                        )}
                        <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={() => confirm(false)}
                            disabled={state === 'working'}
                        >
                            {state === 'working' ? t('auth.linkConfirm.linking') : t('auth.linkConfirm.confirm')}
                        </button>
                    </div>
                )}
            </section>
        </main>
    );
}
