'use client';

import React from 'react';
import Link from 'next/link';
import TranslatableText from './translatableText';
import BuildCard from './buildCard';
import styles from '../styles/Builds.module.css';
import dbStyles from '../styles/Database.module.css';
import { getStsBase } from '../utils/base';
import { decodeBuildName } from '../utils/builder/buildUrlCodec';

export default function BuildsPage() {
    const [authChecked, setAuthChecked] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [builds, setBuilds] = React.useState([]);
    const [loaded, setLoaded] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [editName, setEditName] = React.useState('');
    const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [base, setBase] = React.useState('/sts');

    React.useEffect(() => {
        setBase(getStsBase());
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                setUser(d && d.user ? d.user : null);
                setAuthChecked(true);
            })
            .catch(() => setAuthChecked(true));
    }, []);

    React.useEffect(() => {
        if (!authChecked || !user) return;
        fetch('/api/v1/builds/mine')
            .then((r) => (r.ok ? r.json() : { builds: [] }))
            .then((d) => {
                setBuilds(d.builds || []);
                setLoaded(true);
            })
            .catch(() => {
                setLoaded(true);
            });
    }, [authChecked, user]);

    function displayName(build) {
        if (build.name) return build.name;
        try {
            return decodeBuildName(build.token) || 'Unnamed build';
        } catch (e) {
            return 'Unnamed build';
        }
    }

    function startRename(build) {
        setEditingId(build.id);
        setEditName(displayName(build));
    }

    function submitRename(build) {
        const name = editName.trim();
        setEditingId(null);
        if (!name) return;
        fetch(`/api/v1/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => {
                setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, name } : b)));
            })
            .catch(() => setError('rename'));
    }

    function requestDelete(build) {
        if (confirmDeleteId === build.id) {
            fetch(`/api/v1/builds/${build.id}`, { method: 'DELETE' })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
                .then(() => {
                    setBuilds((prev) => prev.filter((b) => b.id !== build.id));
                    setConfirmDeleteId(null);
                })
                .catch(() => setError('delete'));
        } else {
            setConfirmDeleteId(build.id);
            setTimeout(() => setConfirmDeleteId((cur) => (cur === build.id ? null : cur)), 2500);
        }
    }

    function togglePublic(build) {
        const nextPublic = !build.isPublic;
        setBuilds((prev) => prev.map((b) => (b.id === build.id ? { ...b, publicBusy: true } : b)));
        fetch(`/api/v1/builds/${build.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicise: nextPublic, anonymous: build.anonymous }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                setBuilds((prev) =>
                    prev.map((b) => (b.id === build.id ? { ...b, isPublic: d.isPublic, anonymous: d.anonymous } : b))
                );
            })
            .catch(() => setError('publicise'));
    }

    function toggleFavourite(buildId, favourite) {
        setBuilds((prev) => prev.map((b) => (b.id === buildId ? { ...b, myFavourite: favourite } : b)));
    }

    // The buttons live inside the card, which is a link - stop the click
    // from navigating (or, on touch, from expanding the card first).
    const stop = (fn) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        fn();
    };

    function clearError() {
        setError(null);
    }

    return (
        <div className="container-fluid">
            <main className={styles.page}>
                <h1 className={styles.title}>
                    <TranslatableText identifier="builds.title" />
                </h1>
                <div className={styles.subNav}>
                    <Link className={styles.subNavBtn} href={base + '/builds/favourites'}>
                        <TranslatableText identifier="database.favTitle" />
                    </Link>
                </div>

                {!authChecked ? (
                    <p className={styles.muted}>
                        <TranslatableText identifier="builds.loading" />
                    </p>
                ) : !user ? (
                    <div className={styles.loginPrompt}>
                        <p>
                            <TranslatableText identifier="builds.loginRequired" />
                        </p>
                        <a className={styles.loginBtn} href="/api/auth/discord/login?next=/builds">
                            <TranslatableText identifier="auth.loginWithDiscord" />
                        </a>
                    </div>
                ) : error ? (
                    <p className={styles.error} onClick={clearError} title="Dismiss">
                        <TranslatableText
                            identifier={
                                error === 'rename'
                                    ? 'builds.renameError'
                                    : error === 'delete'
                                      ? 'builds.deleteError'
                                      : 'database.publiciseError'
                            }
                        />
                    </p>
                ) : !loaded ? (
                    <p className={styles.muted}>
                        <TranslatableText identifier="builds.loading" />
                    </p>
                ) : builds.length === 0 ? (
                    <p className={styles.muted}>
                        <TranslatableText identifier="builds.empty" />
                    </p>
                ) : (
                    <div className={dbStyles.grid}>
                        {builds.map((build) => (
                            <div key={build.id} className={styles.cell}>
                                <BuildCard build={build} user={user} base={base} onToggleFavourite={toggleFavourite}>
                                    <div className={styles.cardActions}>
                                        {editingId === build.id ? (
                                            <input
                                                type="text"
                                                className={styles.nameInput}
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        submitRename(build);
                                                    }
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                onBlur={() => submitRename(build)}
                                                autoFocus
                                            />
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className={`${styles.rowBtn}${
                                                        build.isPublic ? ` ${styles.rowBtnPublic}` : ''
                                                    }`}
                                                    onClick={stop(() => togglePublic(build))}
                                                    disabled={build.publicBusy}
                                                    title={build.isPublic ? 'Make private' : 'Publicise'}
                                                >
                                                    {build.isPublic ? (
                                                        <TranslatableText identifier="database.publicBadge" />
                                                    ) : (
                                                        <TranslatableText identifier="database.publicise" />
                                                    )}
                                                    {build.isPublic && build.anonymous && (
                                                        <span className={styles.anonBadge}>
                                                            <TranslatableText identifier="database.anonBadge" />
                                                        </span>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.rowBtn}
                                                    onClick={stop(() => startRename(build))}
                                                    title="Rename"
                                                >
                                                    <TranslatableText identifier="builds.rename" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.rowBtn}
                                                    onClick={stop(() => requestDelete(build))}
                                                    title="Delete"
                                                >
                                                    {confirmDeleteId === build.id ? (
                                                        <TranslatableText identifier="builds.confirmDelete" />
                                                    ) : (
                                                        <TranslatableText identifier="builds.delete" />
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </BuildCard>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
