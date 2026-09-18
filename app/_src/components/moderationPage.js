'use client';

import React from 'react';
import styles from '../styles/Moderation.module.css';
import { useTranslation } from './useTranslation';
import { formatDateString } from '../utils/dateFormat';

const TABS = ['users', 'builds', 'notifications'];
const NOTIFICATION_TYPES = ['info', 'warning', 'error'];

function displayName(row) {
    return row.global_name || row.username || row.id;
}

function SanctionBadge({ sanction, t }) {
    if (!sanction) return <span className={`${styles.badge} ${styles.badgeOk}`}>{t('moderation.sanction.none')}</span>;
    const banned = sanction.kind === 'ban';
    const until = sanction.expires_at ? formatDateString(sanction.expires_at, { spaceToT: true, includeTime: true }) : null;
    return (
        <span className={`${styles.badge} ${banned ? styles.badgeBan : styles.badgeSuspend}`}>
            {banned ? t('moderation.sanction.banned') : t('moderation.sanction.suspended')}
            {until ? ` ${t('moderation.banner.until')} ${until} UTC` : ''}
            {sanction.reason ? ` - ${sanction.reason}` : ''}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function UsersPanel({ t, moderatorId }) {
    const [query, setQuery] = React.useState('');
    const [users, setUsers] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [activeId, setActiveId] = React.useState(null);
    const [mode, setMode] = React.useState('ban');
    const [reason, setReason] = React.useState('');
    const [until, setUntil] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback((q) => {
        fetch(`/api/v2/moderation/users?q=${encodeURIComponent(q)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => setUsers(d.users || []))
            .catch(() => setError(t('moderation.error')));
    }, [t]);

    React.useEffect(() => {
        load('');
    }, [load]);

    function openActions(row, nextMode) {
        setActiveId(row.id);
        setMode(nextMode);
        setReason(row.sanction_reason || '');
        setUntil('');
        setError(null);
    }

    async function applySanction(id) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/v2/moderation/users/${encodeURIComponent(id)}/sanction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: mode, reason: reason.trim() || null, expiresAt: until || null }),
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            setActiveId(null);
            load(query);
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    async function lift(id) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/v2/moderation/users/${encodeURIComponent(id)}/sanction`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            setActiveId(null);
            load(query);
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className={styles.panel}>
            <form
                className={styles.searchRow}
                onSubmit={(e) => {
                    e.preventDefault();
                    load(query.trim());
                }}
            >
                <input
                    className={styles.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('moderation.searchPlaceholder')}
                    aria-label={t('moderation.searchPlaceholder')}
                />
                <button type="submit" className={styles.button}>
                    {t('moderation.search')}
                </button>
            </form>
            {error && <p className={styles.error}>{error}</p>}
            {users === null ? (
                <p className={styles.muted}>{t('moderation.loading')}</p>
            ) : users.length === 0 ? (
                <p className={styles.muted}>{t('moderation.users.none')}</p>
            ) : (
                <ul className={styles.list}>
                    {users.map((row) => (
                        <li key={row.id} className={styles.row}>
                            <div className={styles.rowMain}>
                                <span className={styles.rowTitle}>{displayName(row)}</span>
                                <span className={styles.rowMeta}>
                                    {row.id}
                                    {row.username ? ` · @${row.username}` : ''} · {row.build_count}{' '}
                                    {t('moderation.counts.builds')} · {row.item_count} {t('moderation.counts.items')} ·{' '}
                                    {t('moderation.joined')} {formatDateString(row.created_at, { spaceToT: true })}
                                </span>
                                <SanctionBadge
                                    sanction={
                                        row.sanction_kind
                                            ? {
                                                  kind: row.sanction_kind,
                                                  reason: row.sanction_reason,
                                                  expires_at: row.sanction_expires,
                                              }
                                            : null
                                    }
                                    t={t}
                                />
                            </div>
                            {activeId === row.id ? (
                                <div className={styles.actionPanel}>
                                    <div className={styles.actionTabs}>
                                        <button
                                            type="button"
                                            className={`${styles.chip} ${mode === 'suspend' ? styles.chipActive : ''}`}
                                            onClick={() => setMode('suspend')}
                                        >
                                            {t('moderation.actions.suspend')}
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.chip} ${mode === 'ban' ? styles.chipActive : ''}`}
                                            onClick={() => setMode('ban')}
                                        >
                                            {t('moderation.actions.ban')}
                                        </button>
                                    </div>
                                    {mode === 'suspend' && (
                                        <label className={styles.field}>
                                            <span>{t('moderation.sanction.until')}</span>
                                            <input
                                                type="datetime-local"
                                                className={styles.input}
                                                value={until}
                                                onChange={(e) => setUntil(e.target.value)}
                                            />
                                        </label>
                                    )}
                                    <label className={styles.field}>
                                        <span>{t('moderation.sanction.reason')}</span>
                                        <input
                                            className={styles.input}
                                            value={reason}
                                            maxLength={300}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </label>
                                    <div className={styles.formActions}>
                                        <button
                                            type="button"
                                            className={`${styles.button} ${styles.buttonDanger}`}
                                            disabled={busy}
                                            onClick={() => applySanction(row.id)}
                                        >
                                            {mode === 'ban' ? t('moderation.actions.ban') : t('moderation.actions.suspend')}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.button}
                                            onClick={() => setActiveId(null)}
                                            disabled={busy}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : row.id === moderatorId ? (
                                <span className={styles.rowMeta}>{t('moderation.users.you')}</span>
                            ) : (
                                <div className={styles.rowActions}>
                                    <button
                                        type="button"
                                        className={styles.button}
                                        onClick={() => openActions(row, 'suspend')}
                                        disabled={busy}
                                    >
                                        {t('moderation.actions.suspend')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.button} ${styles.buttonDanger}`}
                                        onClick={() => openActions(row, 'ban')}
                                        disabled={busy}
                                    >
                                        {t('moderation.actions.ban')}
                                    </button>
                                    {row.sanction_kind && (
                                        <button
                                            type="button"
                                            className={styles.button}
                                            onClick={() => lift(row.id)}
                                            disabled={busy}
                                        >
                                            {t('moderation.actions.lift')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

function BuildsPanel({ t }) {
    const [query, setQuery] = React.useState('');
    const [builds, setBuilds] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [confirmId, setConfirmId] = React.useState(null);

    const load = React.useCallback((q) => {
        fetch(`/api/v2/moderation/builds?q=${encodeURIComponent(q)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => setBuilds(d.builds || []))
            .catch(() => setError(t('moderation.error')));
    }, [t]);

    React.useEffect(() => {
        load('');
    }, [load]);

    async function togglePublic(row) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/v2/moderation/builds/${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: row.is_public !== 1 }),
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            load(query);
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    async function remove(id) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/v2/moderation/builds/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            setConfirmId(null);
            load(query);
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className={styles.panel}>
            <form
                className={styles.searchRow}
                onSubmit={(e) => {
                    e.preventDefault();
                    load(query.trim());
                }}
            >
                <input
                    className={styles.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('moderation.builds.searchPlaceholder')}
                    aria-label={t('moderation.builds.searchPlaceholder')}
                />
                <button type="submit" className={styles.button}>
                    {t('moderation.search')}
                </button>
            </form>
            {error && <p className={styles.error}>{error}</p>}
            {builds === null ? (
                <p className={styles.muted}>{t('moderation.loading')}</p>
            ) : builds.length === 0 ? (
                <p className={styles.muted}>{t('moderation.builds.none')}</p>
            ) : (
                <ul className={styles.list}>
                    {builds.map((row) => (
                        <li key={row.id} className={styles.row}>
                            <div className={styles.rowMain}>
                                <span className={styles.rowTitle}>
                                    {row.name || t('moderation.builds.unnamed')}{' '}
                                    <span className={`${styles.badge} ${row.is_public === 1 ? styles.badgePublic : ''}`}>
                                        {row.is_public === 1
                                            ? t('moderation.builds.public')
                                            : t('moderation.builds.private')}
                                    </span>
                                </span>
                                <span className={styles.rowMeta}>
                                    {row.id} · {row.author_name || row.user_id || t('moderation.builds.anonymous')} ·{' '}
                                    {formatDateString(row.updated_at, { spaceToT: true })}
                                </span>
                            </div>
                            <div className={styles.rowActions}>
                                <button
                                    type="button"
                                    className={styles.button}
                                    onClick={() => togglePublic(row)}
                                    disabled={busy}
                                >
                                    {row.is_public === 1
                                        ? t('moderation.builds.unpublish')
                                        : t('moderation.builds.publish')}
                                </button>
                                {confirmId === row.id ? (
                                    <button
                                        type="button"
                                        className={`${styles.button} ${styles.buttonDanger}`}
                                        onClick={() => remove(row.id)}
                                        disabled={busy}
                                    >
                                        {t('moderation.builds.confirmDelete')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className={`${styles.button} ${styles.buttonDanger}`}
                                        onClick={() => setConfirmId(row.id)}
                                        disabled={busy}
                                    >
                                        {t('moderation.builds.delete')}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function NotificationsPanel({ t }) {
    const [message, setMessage] = React.useState('');
    const [type, setType] = React.useState('info');
    const [items, setItems] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(() => {
        fetch('/api/v2/moderation/notifications')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => setItems(d.notifications || []))
            .catch(() => setError(t('moderation.error')));
    }, [t]);

    React.useEffect(() => {
        load();
    }, [load]);

    async function post(event) {
        event.preventDefault();
        if (!message.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/v2/moderation/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message.trim(), type }),
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            setMessage('');
            load();
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    async function remove(id) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/v2/moderation/notifications/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            load();
        } catch (e) {
            setError(t('moderation.error'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className={styles.panel}>
            <form className={styles.notificationForm} onSubmit={post}>
                <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    value={message}
                    maxLength={500}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('moderation.notifications.placeholder')}
                    aria-label={t('moderation.notifications.placeholder')}
                />
                <div className={styles.formActions}>
                    <select className={styles.input} value={type} onChange={(e) => setType(e.target.value)}>
                        {NOTIFICATION_TYPES.map((value) => (
                            <option key={value} value={value}>
                                {t(`moderation.notifications.type.${value}`)}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className={styles.button} disabled={busy || !message.trim()}>
                        {t('moderation.notifications.post')}
                    </button>
                </div>
            </form>
            {error && <p className={styles.error}>{error}</p>}
            {items === null ? (
                <p className={styles.muted}>{t('moderation.loading')}</p>
            ) : items.length === 0 ? (
                <p className={styles.muted}>{t('moderation.notifications.none')}</p>
            ) : (
                <ul className={styles.list}>
                    {items.map((item) => (
                        <li key={item.id} className={styles.row}>
                            <div className={styles.rowMain}>
                                <span className={styles.rowTitle}>{item.message}</span>
                                <span className={styles.rowMeta}>
                                    {item.author || t('moderation.builds.anonymous')} ·{' '}
                                    {formatDateString(item.created_at, { spaceToT: true })} · {item.type}
                                </span>
                            </div>
                            <div className={styles.rowActions}>
                                <button
                                    type="button"
                                    className={`${styles.button} ${styles.buttonDanger}`}
                                    onClick={() => remove(item.id)}
                                    disabled={busy}
                                >
                                    {t('common.delete')}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function ModerationPage({ moderator, moderatorId }) {
    const t = useTranslation();
    const [tab, setTab] = React.useState('users');
    return (
        <main className={styles.page}>
            <h1 className={styles.title}>
                {t('moderation.title')}{' '}
                <span className={styles.experimentalBadge}>{t('moderation.experimental')}</span>
            </h1>
            {moderator ? <p className={styles.muted}>{t('moderation.signedInAs')} {moderator}</p> : null}
            <nav className={styles.tabs} aria-label={t('moderation.title')}>
                {TABS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
                        aria-current={tab === key ? 'page' : undefined}
                        onClick={() => setTab(key)}
                    >
                        {t(`moderation.tabs.${key}`)}
                    </button>
                ))}
            </nav>
            {tab === 'users' && <UsersPanel t={t} moderatorId={moderatorId} />}
            {tab === 'builds' && <BuildsPanel t={t} />}
            {tab === 'notifications' && <NotificationsPanel t={t} />}
        </main>
    );
}
