'use client';

// Saved skill & delve sets (Discord users only). Lives under the builder's
// top row: a single panel that can
//   1. copy the skill portion (class/spec/points/enhancements/CZ) out of any
//      of the caller's own saved builds,
//   2. save the current skill layout (or the current delve infusions) as a
//      named set for later, and apply/delete saved sets.
// All API work happens here; the BuildForm drives state changes through the
// callbacks below so the panel stays decoupled from the giant form.
import React from 'react';
import styles from '../../styles/Items.module.css';

const KIND_LABELS = {
    skills: 'Skill sets',
    delve: 'Infusion sets',
};

function humanClass(cl) {
    if (!cl) return null;
    return cl.charAt(0).toUpperCase() + cl.slice(1);
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function SavedSetsPanel({
    getSnapshot,
    deleteSet,
    applySkillPayload,
    applyDelvePayload,
    copyBuildSkills,
}) {
    const [loggedIn, setLoggedIn] = React.useState(null); // null = checking
    const [sets, setSets] = React.useState([]);
    const [myBuilds, setMyBuilds] = React.useState([]);
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
        fetch('/api/v1/skill-sets')
            .then((r) => (r.ok ? r.json() : { sets: [] }))
            .then((d) => setSets(d.sets || []))
            .catch(() => {});
        fetch('/api/v1/builds/mine')
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
                    say(ok, ok ? 'Set deleted.' : 'Could not delete the set.');
                    refresh();
                })
                .catch(() => say(false, 'Could not delete the set.'))
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
            say(false, 'Pick a name for the set first.');
            return;
        }
        const payload = getSnapshot(kind);
        if (!payload) {
            say(false, 'Nothing to save yet - choose a class first.');
            return;
        }
        setBusy(true);
        try {
            const res = await fetch('/api/v1/skill-sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, name, payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                say(false, 'Could not save the set.');
            } else {
                setNames((prev) => ({ ...prev, [kind]: '' }));
                say(true, data.isNew ? `"${name}" saved.` : `"${name}" updated.`);
                refresh();
            }
        } catch (e) {
            say(false, 'Could not save the set.');
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
                  : 'That set has no class.';
        say(!err, err || `"${entry.name}" applied.`);
    }

    async function handleCopyBuild(build) {
        setBusy(true);
        try {
            const err = await copyBuildSkills(build);
            say(!err, err || `Skills copied from "${build.name || 'this build'}".`);
        } catch (e) {
            say(false, 'Could not read that build.');
        } finally {
            setBusy(false);
        }
    }

    const kindGroups = (kind) => sets.filter((s) => s.kind === kind);

    return (
        <div className={styles.setsPanel}>
            {loggedIn === false ? (
                <p className={styles.setsHint}>
                    Log in with Discord to save skill and infusion sets and to copy skills from your saved builds.
                </p>
            ) : loggedIn === null ? (
                <p className={styles.setsHint}>Loading…</p>
            ) : (
                <>
                    <div className={styles.setsColumns}>
                        <section className={styles.setsGroup}>
                            <h3 className={styles.setsGroupTitle}>Copy from your builds</h3>
                            {myBuilds.length === 0 ? (
                                <p className={styles.setsEmpty}>No saved builds yet.</p>
                            ) : (
                                <ul className={styles.setsList}>
                                    {myBuilds.map((b) => (
                                        <li key={b.id} className={styles.setsRow}>
                                            <span className={styles.setsRowName}>
                                                {b.name || 'Unnamed build'}
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
                                                Copy skills
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {(['skills', 'delve']).map((kind) => {
                            const list = kindGroups(kind);
                            return (
                                <section key={kind} className={styles.setsGroup}>
                                    <h3 className={styles.setsGroupTitle}>{KIND_LABELS[kind]}</h3>
                                    <div className={styles.setsSaveRow}>
                                        <input
                                            className={styles.setsInput}
                                            placeholder="Set name"
                                            maxLength={40}
                                            value={names[kind]}
                                            onChange={(e) =>
                                                setNames((prev) => ({ ...prev, [kind]: e.target.value }))
                                            }
                                        />
                                        <button
                                            type="button"
                                            className={styles.setsBtn}
                                            disabled={busy}
                                            onClick={() => handleSave(kind)}
                                        >
                                            Save current
                                        </button>
                                    </div>
                                    {list.length === 0 ? (
                                        <p className={styles.setsEmpty}>
                                            {kind === 'skills'
                                                ? 'No skill sets saved yet.'
                                                : 'No infusion sets saved yet.'}
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
                                                            Apply
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.setsBtn} ${styles.setsBtnDanger}`}
                                                            disabled={busy}
                                                            onClick={() => requestDelete(entry.id)}
                                                        >
                                                            {confirmDelete === entry.id ? 'Sure?' : '✕'}
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
                        <p className={feedback.ok ? styles.setsFeedbackOk : styles.setsFeedbackErr}>
                            {feedback.text}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
