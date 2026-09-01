'use client';

import React from 'react';
import styles from '../styles/Account.module.css';

// Confirmation page for the /stsmod link flow: the player ran the command in
// game, got a temp link, and landed here. If they're not logged in yet they
// log in with Discord first (the login flow returns them to this page), then
// confirm - which binds their Minecraft UUID to their Discord account.
export default function LinkConfirmPage({ code, pending, user, profile }) {
    const [state, setState] = React.useState('idle');
    const [error, setError] = React.useState(null);

    const next = `/link/${code}`;

    function confirm() {
        setState('working');
        setError(null);
        fetch('/api/v1/mod/link/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject({ status: r.status })))
            .then(() => setState('done'))
            .catch((e) => {
                if (e.status === 409) {
                    setError(
                        'This Minecraft profile is already linked to a different Discord account. Disconnect it there first: '
                    );
                } else {
                    setError('This link is invalid or has expired. Run /stsmod link in game to get a fresh one.');
                }
                setState('idle');
            });
    }

    if (!pending) {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>Link Minecraft profile</h1>
                <p className={styles.muted}>
                    This link is invalid or has expired. Run /stsmod link in game to get a fresh one.
                </p>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Link Minecraft profile</h1>
            <section className={styles.card}>
                <div className={styles.row}>
                    <span className={styles.rowLabel}>Minecraft profile</span>
                    {profile && profile.avatarUrl && (
                        <img className={styles.mcAvatar} src={profile.avatarUrl} alt="" width="32" height="32" />
                    )}
                    <code className={styles.uuid}>{profile && profile.name ? profile.name : pending.uuid}</code>
                    {profile && profile.name && <span className={styles.uuidMuted}>({pending.uuid})</span>}
                </div>
                {user && (
                    <div className={styles.row}>
                        <span className={styles.rowLabel}>Discord account</span>
                        <span className={styles.rowValue}>{user.globalName || user.username}</span>
                    </div>
                )}

                {state === 'done' ? (
                    <p className={styles.success}>
                        Linked! Saving builds from the STS mod armoury will now store them on your account.{' '}
                        <a className={styles.loginLink} href="/account">
                            Manage your linked profiles
                        </a>
                    </p>
                ) : !user ? (
                    <p className={styles.muted}>
                        <a
                            className={styles.loginLink}
                            href={`/api/auth/discord/login?next=${encodeURIComponent(next)}`}
                        >
                            Log in with Discord
                        </a>{' '}
                        to confirm that this Minecraft profile belongs to you.
                    </p>
                ) : (
                    <div>
                        {error && (
                            <p className={styles.error}>
                                {error}
                                {error.includes('different Discord account') && (
                                    <a className={styles.loginLink} href="/account">
                                        Manage profiles
                                    </a>
                                )}
                            </p>
                        )}
                        <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={confirm}
                            disabled={state === 'working'}
                        >
                            {state === 'working' ? 'Linking…' : 'Confirm link'}
                        </button>
                    </div>
                )}
            </section>
        </main>
    );
}
