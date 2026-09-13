'use client';

import React from 'react';
import styles from '../styles/Account.module.css';
import { useSessionState } from './header';

// The signed-in user's account page: Discord identity plus the Minecraft
// UUIDs linked to it. Linking itself happens in game (/stsmod link); this
// page is where a player disconnects a UUID so it can be linked to a
// different Discord account. Account deletion lives here too. The site
// look settings live on their own page (/settings) for everyone.
export default function AccountPage() {
    const session = useSessionState();
    const [links, setLinks] = React.useState([]);
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(null);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState(null);
    const [savingAvatar, setSavingAvatar] = React.useState(false);
    const [avatarError, setAvatarError] = React.useState(null);
    const [copiedUuid, setCopiedUuid] = React.useState(null);

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

    // Short display form: enough of both ends to recognise the UUID; the copy
    // button hands out the full value.
    function shortUuid(uuid) {
        if (typeof uuid !== 'string' || uuid.length <= 14) return uuid;
        return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
    }

    function copyUuid(uuid) {
        navigator.clipboard
            .writeText(uuid)
            .then(() => {
                setCopiedUuid(uuid);
                setTimeout(() => setCopiedUuid((current) => (current === uuid ? null : current)), 1500);
            })
            .catch(() => {});
    }

    function chooseAvatar(source) {
        if (!session.user || savingAvatar || source === session.user.avatarSource) return;
        setSavingAvatar(true);
        setAvatarError(null);
        fetch('/api/v1/account/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                session.setUser({ ...session.user, avatarUrl: d.avatarUrl, avatarSource: d.avatarSource });
                window.dispatchEvent(new CustomEvent('sts-avatar-updated', { detail: { avatarUrl: d.avatarUrl } }));
            })
            .catch(() => setAvatarError('Could not update your profile picture. Try again.'))
            .finally(() => setSavingAvatar(false));
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

    if (!session.checked) {
        return (
            <main className={styles.page}>
                <div className={`${styles.sk} ${styles.skTitle}`} />
                <div className={styles.skTabRow}>
                    <div className={`${styles.sk} ${styles.skTab}`} />
                    <div className={`${styles.sk} ${styles.skTab}`} />
                </div>
                <div className={`${styles.sk} ${styles.skCard}`} />
                <div className={`${styles.sk} ${styles.skCard}`} />
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>My Account</h1>
            <nav className={styles.tabs} aria-label="Account navigation">
                <span className={`${styles.tab} ${styles.tabActive}`} aria-current="page">
                    My Account
                </span>
                <a className={styles.tab} href="/settings">
                    Site settings
                </a>
            </nav>
            {session.user ? (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Linked accounts</h2>
                    <ul className={styles.linkList}>
                        <li className={styles.linkRow}>
                            {session.user.discordAvatarUrl || session.user.avatarUrl ? (
                                <img
                                    className={styles.mcAvatar}
                                    src={session.user.discordAvatarUrl || session.user.avatarUrl}
                                    alt=""
                                    width="32"
                                    height="32"
                                />
                            ) : null}
                            <span className={styles.rowValue}>{session.user.globalName || session.user.username}</span>
                            <span className={styles.linkDate}>
                                {session.user.stsCreatedAt ? `created ${session.user.stsCreatedAt.slice(0, 10)}` : ''}
                            </span>
                        </li>
                    </ul>
                    {error && <p className={styles.error}>{error}</p>}
                    {!loaded ? (
                        <ul className={styles.linkList}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <li key={i} className={styles.linkRow}>
                                    <div className={`${styles.sk} ${styles.skIcon}`} />
                                    <div className={`${styles.sk} ${styles.skLine}`} />
                                    <div className={`${styles.sk} ${styles.skLineShort}`} />
                                </li>
                            ))}
                        </ul>
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
                                    {link.mcName && (
                                        <span className={styles.uuidWrap}>
                                            <code className={styles.uuidMuted} title={link.uuid}>
                                                {shortUuid(link.uuid)}
                                            </code>
                                            <button
                                                type="button"
                                                className={styles.copyUuidButton}
                                                onClick={() => copyUuid(link.uuid)}
                                                aria-label={`Copy UUID ${link.uuid}`}
                                                title="Copy UUID"
                                            >
                                                {copiedUuid === link.uuid ? 'Copied!' : 'Copy'}
                                            </button>
                                        </span>
                                    )}
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
            ) : (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Linked accounts</h2>
                    <p className={styles.muted}>
                        <a
                            href={`/api/auth/discord/login?next=${encodeURIComponent('/account')}`}
                            className={styles.loginLink}
                        >
                            Log in with Discord
                        </a>{' '}
                        to manage your linked Minecraft profiles.
                    </p>
                </section>
            )}

            {session.user && (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Profile picture</h2>
                    <p className={styles.muted}>
                        Choose what other players see next to your builds and custom items.
                    </p>
                    <div className={styles.avatarChoices}>
                        <button
                            type="button"
                            className={`${styles.avatarChoice}${
                                session.user.avatarSource !== 'minecraft' ? ` ${styles.avatarChoiceActive}` : ''
                            }`}
                            onClick={() => chooseAvatar('discord')}
                            disabled={savingAvatar}
                            aria-pressed={session.user.avatarSource !== 'minecraft'}
                        >
                            {session.user.discordAvatarUrl ? (
                                <img src={session.user.discordAvatarUrl} alt="" width="48" height="48" />
                            ) : (
                                <span className={styles.avatarPlaceholder} aria-hidden="true" />
                            )}
                            <span className={styles.avatarChoiceLabel}>Discord</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.avatarChoice}${
                                session.user.avatarSource === 'minecraft' ? ` ${styles.avatarChoiceActive}` : ''
                            }`}
                            onClick={() => chooseAvatar('minecraft')}
                            disabled={savingAvatar || !session.user.minecraftAvatarUrl}
                            aria-pressed={session.user.avatarSource === 'minecraft'}
                        >
                            {session.user.minecraftAvatarUrl ? (
                                <img
                                    className={styles.avatarPixel}
                                    src={session.user.minecraftAvatarUrl}
                                    alt=""
                                    width="48"
                                    height="48"
                                />
                            ) : (
                                <span className={styles.avatarPlaceholder} aria-hidden="true" />
                            )}
                            <span className={styles.avatarChoiceLabel}>Minecraft</span>
                        </button>
                    </div>
                    {!session.user.minecraftAvatarUrl && (
                        <p className={styles.muted}>
                            Link a Minecraft profile below to use its avatar as your profile picture.
                        </p>
                    )}
                    {avatarError && <p className={styles.error}>{avatarError}</p>}
                </section>
            )}

            {session.user && (
                <section className={`${styles.card} ${styles.dangerCard}`}>
                    <h2 className={styles.cardTitle}>Danger zone</h2>
                    <p className={styles.muted}>
                        Deleting your profile removes your favourites, custom items and Minecraft profile links. Your
                        saved builds keep their links but leave the public database and are no longer associated with
                        your account.
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
            )}
        </main>
    );
}
