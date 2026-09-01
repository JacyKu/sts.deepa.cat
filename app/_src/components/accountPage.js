'use client';

import React from 'react';
import styles from '../styles/Account.module.css';
import { useSessionState } from './header';

// The signed-in user's account page: Discord identity plus the Minecraft
// UUIDs linked to it. Linking itself happens in game (/stsmod link); this
// page is where a player disconnects a UUID so it can be linked to a
// different Discord account. Account deletion lives here too.
export default function AccountPage() {
    const session = useSessionState();
    const [links, setLinks] = React.useState([]);
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(null);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState(null);

    React.useEffect(() => {
        if (!session.checked) return;
        if (!session.user) {
            setLoaded(true);
            return;
        }
        fetch('/api/v1/mod/link')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                setLinks(d.links || []);
                setLoaded(true);
            })
            .catch(() => {
                setLoaded(true);
            });
    }, [session.checked, session.user]);

    function unlink(uuid) {
        setBusy(uuid);
        setError(null);
        fetch('/api/v1/mod/link?uuid=' + encodeURIComponent(uuid), { method: 'DELETE' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => setLinks((prev) => prev.filter((l) => l.uuid !== uuid)))
            .catch(() => setError('Could not disconnect the Minecraft profile.'))
            .finally(() => setBusy(null));
    }

    function deleteProfile() {
        setDeleting(true);
        setDeleteError(null);
        fetch('/api/v1/account/delete', { method: 'POST' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => {
                window.location.href = '/';
            })
            .catch(() => setDeleteError('Could not delete your profile. Try again.'))
            .finally(() => setDeleting(false));
    }

    if (!session.checked) return null;

    if (!session.user) {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>My Account</h1>
                <p className={styles.muted}>
                    <a
                        href={`/api/auth/discord/login?next=${encodeURIComponent('/account')}`}
                        className={styles.loginLink}
                    >
                        Log in with Discord
                    </a>{' '}
                    to manage your linked Minecraft profiles.
                </p>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>My Account</h1>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Discord</h2>
                <div className={styles.row}>
                    <span className={styles.rowLabel}>Logged in as</span>
                    <span className={styles.rowValue}>{session.user.globalName || session.user.username}</span>
                </div>
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Linked Minecraft profiles</h2>
                <p className={styles.muted}>
                    Profiles linked from the Spare the Sympathy mod in game. When a profile is linked, saving a build
                    from the armoury stores it on this account.
                </p>
                {error && <p className={styles.error}>{error}</p>}
                {!loaded ? (
                    <p className={styles.muted}>Loading…</p>
                ) : links.length === 0 ? (
                    <p className={styles.muted}>
                        No linked profiles. Run <code>/stsmod link</code> in game with the Spare the Sympathy mod
                        installed to link your Minecraft profile.
                    </p>
                ) : (
                    <ul className={styles.linkList}>
                        {links.map((link) => (
                            <li key={link.uuid} className={styles.linkRow}>
                                {link.mcAvatar && (
                                    <img
                                        className={styles.mcAvatar}
                                        src={link.mcAvatar}
                                        alt=""
                                        width="32"
                                        height="32"
                                    />
                                )}
                                <span className={styles.rowValue}>{link.mcName || link.uuid}</span>
                                {link.mcName && <code className={styles.uuid}>{link.uuid}</code>}
                                <span className={styles.linkDate}>
                                    linked {link.updated_at || link.created_at || ''}
                                </span>
                                <button
                                    type="button"
                                    className={styles.unlinkButton}
                                    onClick={() => unlink(link.uuid)}
                                    disabled={busy === link.uuid}
                                >
                                    {busy === link.uuid ? 'Disconnecting…' : 'Disconnect'}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Danger zone</h2>
                <p className={styles.muted}>
                    Deleting your profile removes your favourites, custom items and Minecraft profile links. Your saved
                    builds keep their links but leave the public database and are no longer associated with your
                    account.
                </p>
                {deleteError && <p className={styles.error}>{deleteError}</p>}
                {!confirmDelete ? (
                    <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => setConfirmDelete(true)}
                        disabled={deleting}
                    >
                        Delete my profile
                    </button>
                ) : (
                    <div className={styles.confirmRow}>
                        <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={deleteProfile}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : 'Yes, delete my profile'}
                        </button>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </section>
        </main>
    );
}
