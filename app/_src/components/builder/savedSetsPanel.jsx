'use client';

// Saved skill & delve sets (Discord users only). Lives under the builder's
// top row: a single panel that can
//   1. copy the skill portion (class/spec/points/enhancements/CZ) out of any
//      of the caller's own saved builds,
//   2. save the current skill layout (or the current delve infusions) as a
//      named set for later, and apply/delete saved sets,
//   3. share a set as a public link (/builder?set=<id>) that anyone can open
//      and apply in the builder; sharing can be stopped again.
// All API work happens here; the BuildForm drives state changes through the
// callbacks below so the panel stays decoupled from the giant form.
import React from 'react';
import styles from '../../styles/Items.module.css';
import { formatDateString } from '../../utils/dateFormat';
import { useTranslation } from '../useTranslation';

function humanClass(cl) {
    if (!cl) return null;
    return cl.charAt(0).toUpperCase() + cl.slice(1);
}

function formatDate(iso) {
    return formatDateString(iso, { spaceToT: true });
}

export default function SavedSetsPanel({
    getSnapshot,
    deleteSet,
    applySkillPayload,
    applyDelvePayload,
    copyBuildSkills,
}) {
    const [loggedIn, setLoggedIn] = React.useState(null); // null = checking
    const t = useTranslation();
    const KIND_LABELS = {
        skills: t('builder.sets.skillSets'),
        delve: t('builder.sets.infusionSets'),
    };
    const [sets, setSets] = React.useState([]);
    const [myBuilds, setMyBuilds] = React.useState([]);
    const [buildQuery, setBuildQuery] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [names, setNames] = React.useState({ skills: '', delve: '' });
    const [feedback, setFeedback] = React.useState(null); // { ok, text }
    const [confirmDelete, setConfirmDelete] = React.useState(null); // set id awaiting 2nd click
    const confirmTimer = React.useRef(null);

    // Only reachable servers after login; swallow auth failures so the panel
    // degrades to the "log in" hint instead of erroring.
    React.useEffect(() => {
        let active = true;
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!active) return;
                setLoggedIn(Boolean(d && d.user));
                if (d && d.user) refresh();
            })
            .catch(() => active && setLoggedIn(false));
        return () => {
            active = false;
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function refresh() {
        fetch('/api/v2/skill-sets')
            .then((r) => (r.ok ? r.json() : { sets: [] }))
            .then((d) => setSets(d.sets || []))
            .catch(() => {});
        fetch('/api/v2/builds/mine')
            .then((r) => (r.ok ? r.json() : { builds: [] }))
            .then((d) => setMyBuilds((d.builds || []).filter((b) => b.class)))
            .catch(() => {});
    }

    function say(ok, text) {
        setFeedback({ ok, text });
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = window.setTimeout(() => setFeedback(null), 4000);
    }
    const feedbackTimer = React.useRef(null);

    function clearDeleteConfirm() {
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        setConfirmDelete(null);
    }

    function requestDelete(id) {
        if (confirmDelete === id) {
            clearDeleteConfirm();
            setBusy(true);
            deleteSet(id)
                .then((ok) => {
                    say(ok, ok ? t('builder.sets.deleted') : t('builder.sets.deleteError'));
                    refresh();
                })
                .catch(() => say(false, t('builder.sets.deleteError')))
                .finally(() => setBusy(false));
            return;
        }
        setConfirmDelete(id);
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
    }

    async function handleSave(kind) {
        const name = String(names[kind] || '').trim();
        if (!name) {
            say(false, t('builder.sets.pickName'));
            return;
        }
        const payload = getSnapshot(kind);
        if (!payload) {
            say(false, t('builder.sets.nothingToSave'));
            return;
        }
        setBusy(true);
        try {
            const res = await fetch('/api/v2/skill-sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, name, payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                say(false, t('builder.sets.saveError'));
            } else {
                setNames((prev) => ({ ...prev, [kind]: '' }));
                say(true, `"${name}" ${data.isNew ? t('builder.sets.saved') : t('builder.sets.updated')}.`);
                refresh();
            }
        } catch (e) {
            say(false, t('builder.sets.saveError'));
        } finally {
            setBusy(false);
        }
    }

    function handleApply(entry) {
        const err =
            entry.kind === 'delve'
                ? applyDelvePayload(entry.payload)
                : entry.payload && entry.payload.cl
                  ? applySkillPayload(entry.payload)
                  : t('builder.sets.noClass');
        say(!err, err || `"${entry.name}" ${t('builder.sets.applied')}.`);
    }

    async function handleCopyBuild(build) {
        setBusy(true);
        try {
            const err = await copyBuildSkills(build);
            say(!err, err || `${t('builder.sets.skillsCopied')} "${build.name || t('builder.sets.thisBuild')}".`);
        } catch (e) {
            say(false, t('builder.sets.couldNotReadBuild'));
        } finally {
            setBusy(false);
        }
    }

    // Public link for a shared set: it opens the builder with the set
    // applied. The URL is stable while sharing is on; unsharing makes it
    // fall back to a plain builder link for everyone.
    function copyShareLink(id) {
        const url = `${window.location.origin}/builder?set=${id}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
                .writeText(url)
                .then(() => say(true, t('builder.sets.shareLinkCopied')))
                .catch(() => say(true, `${t('builder.sets.shareLink')} ${url}`));
        } else {
            say(true, `${t('builder.sets.shareLink')} ${url}`);
        }
    }

    // Toggles a set's public share state (owner only, enforced server-side)
    // and copies the link when sharing starts.
    async function toggleShare(entry, next) {
        setBusy(true);
        try {
            const res = await fetch(`/api/v2/skill-sets/${encodeURIComponent(entry.id)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public: next }),
            });
            if (!res.ok) {
                say(false, next ? t('builder.sets.shareError') : t('builder.sets.unshareError'));
                return;
            }
            setSets((prev) => prev.map((s) => (s.id === entry.id ? { ...s, isPublic: next } : s)));
            if (next) {
                say(true, `"${entry.name}" ${t('builder.sets.shared')}.`);
                copyShareLink(entry.id);
            } else {
                say(true, t('builder.sets.sharingStopped'));
            }
        } catch (e) {
            say(false, next ? t('builder.sets.shareError') : t('builder.sets.unshareError'));
        } finally {
            setBusy(false);
        }
    }

    const kindGroups = (kind) => sets.filter((s) => s.kind === kind);

    // The "copy from your builds" list can get long, so it filters by name,
    // class or spec as the user types.
    const buildQueryTrimmed = buildQuery.trim().toLowerCase();
    const visibleBuilds = buildQueryTrimmed
        ? myBuilds.filter((b) =>
              [b.name, b.class, b.spec].some((value) =>
                  String(value || '')
                      .toLowerCase()
                      .includes(buildQueryTrimmed)
              )
          )
        : myBuilds;

    return (
        <div className={styles.setsPanel}>
            {loggedIn === false ? (
                <p className={styles.setsHint}>{t('builder.sets.loginRequired')}</p>
            ) : loggedIn === null ? (
                <p className={styles.setsHint}>{t('common.loading')}</p>
            ) : (
                <>
                    <div className={styles.setsColumns}>
                        <section className={styles.setsGroup}>
                            <h3 className={styles.setsGroupTitle}>{t('builder.sets.copyFromBuilds')}</h3>
                            {myBuilds.length === 0 ? (
                                <p className={styles.setsEmpty}>{t('builder.sets.noSavedBuilds')}</p>
                            ) : (
                                <>
                                    <div className={styles.setsSaveRow}>
                                        <input
                                            className={styles.setsInput}
                                            type="search"
                                            placeholder={t('builder.sets.searchYourBuilds')}
                                            value={buildQuery}
                                            onChange={(e) => setBuildQuery(e.target.value)}
                                            aria-label={t('builder.sets.searchYourBuilds')}
                                        />
                                    </div>
                                    {visibleBuilds.length === 0 ? (
                                        <div className={styles.setsBuildList}>
                                            <p className={styles.setsEmpty}>{t('builder.sets.noBuildsMatch')}</p>
                                        </div>
                                    ) : (
                                        <div className={styles.setsBuildList}>
                                            <ul className={styles.setsList}>
                                                {visibleBuilds.map((b) => (
                                                    <li key={b.id} className={styles.setsRow}>
                                                        <span className={styles.setsRowName}>
                                                            {b.name || t('builder.sets.unnamedBuild')}
                                                            {b.class ? (
                                                                <span className={styles.setsMeta}>
                                                                    {humanClass(b.class)}
                                                                    {b.spec ? ` / ${b.spec}` : ''}
                                                                </span>
                                                            ) : (
                                                                ''
                                                            )}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className={styles.setsBtn}
                                                            disabled={busy}
                                                            onClick={() => handleCopyBuild(b)}
                                                        >
                                                            {t('builder.sets.copySkills')}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>

                        {['skills', 'delve'].map((kind) => {
                            const list = kindGroups(kind);
                            return (
                                <section key={kind} className={styles.setsGroup}>
                                    <h3 className={styles.setsGroupTitle}>{KIND_LABELS[kind]}</h3>
                                    <div className={styles.setsSaveRow}>
                                        <input
                                            className={styles.setsInput}
                                            placeholder={t('builder.sets.setName')}
                                            maxLength={40}
                                            value={names[kind]}
                                            onChange={(e) => setNames((prev) => ({ ...prev, [kind]: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            className={styles.setsBtn}
                                            disabled={busy}
                                            onClick={() => handleSave(kind)}
                                        >
                                            {t('builder.sets.saveCurrent')}
                                        </button>
                                    </div>
                                    {list.length === 0 ? (
                                        <p className={styles.setsEmpty}>
                                            {kind === 'skills'
                                                ? t('builder.sets.noSkillSets')
                                                : t('builder.sets.noInfusionSets')}
                                        </p>
                                    ) : (
                                        <ul className={styles.setsList}>
                                            {list.map((entry) => (
                                                <li key={entry.id} className={styles.setsRow}>
                                                    <span className={styles.setsRowName}>
                                                        {entry.name}
                                                        {entry.kind === 'skills' && entry.className ? (
                                                            <span className={styles.setsMeta}>
                                                                {humanClass(entry.className)}
                                                                {entry.spec ? ` / ${entry.spec}` : ''}
                                                            </span>
                                                        ) : (
                                                            ''
                                                        )}
                                                        {formatDate(entry.updatedAt)
                                                            ? ` · ${formatDate(entry.updatedAt)}`
                                                            : ''}
                                                    </span>
                                                    <span className={styles.setsRowActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.setsBtn}
                                                            disabled={busy}
                                                            onClick={() => handleApply(entry)}
                                                        >
                                                            {t('common.apply')}
                                                        </button>
                                                        {entry.isPublic ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className={styles.setsBtn}
                                                                    disabled={busy}
                                                                    onClick={() => copyShareLink(entry.id)}
                                                                >
                                                                    {t('common.copyLink')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={styles.setsBtn}
                                                                    disabled={busy}
                                                                    onClick={() => toggleShare(entry, false)}
                                                                >
                                                                    {t('builder.sets.unshare')}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className={styles.setsBtn}
                                                                disabled={busy}
                                                                onClick={() => toggleShare(entry, true)}
                                                            >
                                                                {t('builder.buttons.share')}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className={`${styles.setsBtn} ${styles.setsBtnDanger}`}
                                                            disabled={busy}
                                                            onClick={() => requestDelete(entry.id)}
                                                        >
                                                            {confirmDelete === entry.id ? t('builder.sets.sure') : '✕'}
                                                        </button>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                    {feedback && (
                        <p className={feedback.ok ? styles.setsFeedbackOk : styles.setsFeedbackErr}>{feedback.text}</p>
                    )}
                </>
            )}
        </div>
    );
}
