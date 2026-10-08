'use client';

import React from 'react';
import styles from '../styles/Polls.module.css';
import itemsStyles from '../styles/Items.module.css';
import SpookyArt from './spookyArt';
import { useTranslation } from './useTranslation';
import { formatDateString } from '../utils/dateFormat';
import { filterBadWords } from '../utils/badWords';

function percent(votes, total) {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
}

function voteLabel(t, count) {
    return `${count} ${count === 1 ? t('polls.voteSingular') : t('polls.votes')}`;
}

// One poll: open polls are interactive (click an option to vote, suggest a
// name), closed polls show the winning name. Every write returns the fresh
// poll, so the counts update in place.
function PollCard({ poll: initial, viewer, onUpdated, onFiltered }) {
    const t = useTranslation();
    const [poll, setPoll] = React.useState(initial);
    React.useEffect(() => {
        setPoll(initial);
    }, [initial]);
    const [name, setName] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [notice, setNotice] = React.useState(null);
    // The option id whose "delete" confirmation is open, or null.
    const [confirming, setConfirming] = React.useState(null);
    const open = poll.status === 'open';
    const total = poll.totalVotes;

    async function send(url, body) {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error((data && data.error) || 'HTTP ' + response.status);
            if (data && data.poll) {
                setPoll(data.poll);
                onUpdated(data.poll);
            }
            return true;
        } catch (e) {
            setError(e.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function suggest(event) {
        event.preventDefault();
        const value = name.trim();
        if (!value) return;
        if (await send(`/api/v2/polls/${poll.id}/options`, { name: value })) {
            setName('');
            setNotice(t('polls.suggested'));
        }
    }

    // Withdraw the caller's own suggested name (after the inline confirm).
    async function removeOption(optionId) {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/v2/polls/${poll.id}/options/${optionId}`, { method: 'DELETE' });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error((data && data.error) || 'HTTP ' + response.status);
            if (data && data.poll) {
                setPoll(data.poll);
                onUpdated(data.poll);
            }
            setConfirming(null);
            setNotice(t('polls.optionDeleted'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <article className={styles.pollCard}>
            <div className={styles.pollHead}>
                <span className={styles.pollTitle}>{poll.title}</span>
                <span className={`${styles.badge} ${open ? styles.statusOpen : styles.statusClosed}`}>
                    {open ? t('polls.open') : t('polls.closed')}
                </span>
                {poll.runAt ? (
                    <span className={styles.meta}>
                        {t('polls.attachedRun')} {formatDateString(poll.runAt, { includeTime: true, utc: true })}
                    </span>
                ) : null}
            </div>
            {!open && poll.winnerName ? (
                <p className={styles.winner}>
                    {t('polls.winner')}: <b>{poll.winnerName}</b>
                </p>
            ) : null}
            <div className={styles.optionList}>
                {poll.options.map((option) => {
                    const pct = percent(option.votes, total);
                    const classes = [styles.optionRow];
                    if (option.mine) classes.push(styles.optionMine);
                    if (option.id === poll.winnerOptionId) classes.push(styles.optionWinner);
                    const canDelete = open && viewer && option.submittedBy === viewer.id;
                    return (
                        <div key={option.id} className={styles.optionRowWrap}>
                            <button
                                type="button"
                                className={classes.join(' ')}
                                style={{ '--pct': `${pct}%` }}
                                disabled={!open || busy}
                                onClick={() => send(`/api/v2/polls/${poll.id}/vote`, { optionId: option.id })}
                                title={open ? t('polls.voteHint') : undefined}
                            >
                                <span className={styles.optionName}>
                                    {option.name}
                                    {option.mine ? (
                                        <span className={styles.optionTag}>({t('polls.yourVote')})</span>
                                    ) : null}
                                </span>
                                <span className={styles.optionVotes}>
                                    {voteLabel(t, option.votes)} · {pct}%
                                </span>
                            </button>
                            {canDelete ? (
                                confirming === option.id ? (
                                    <span className={styles.deleteConfirm}>
                                        <button
                                            type="button"
                                            className={styles.confirmDelete}
                                            disabled={busy}
                                            onClick={() => removeOption(option.id)}
                                        >
                                            {t('common.delete')}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.confirmCancel}
                                            disabled={busy}
                                            onClick={() => setConfirming(null)}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className={styles.optionDelete}
                                        disabled={busy}
                                        title={t('polls.deleteOption')}
                                        aria-label={`${t('polls.deleteOption')}: ${option.name}`}
                                        onClick={() => setConfirming(option.id)}
                                    >
                                        ×
                                    </button>
                                )
                            ) : null}
                        </div>
                    );
                })}
                {poll.options.length === 0 ? <p className={styles.muted}>{t('polls.noOptions')}</p> : null}
            </div>
            <div className={styles.pollFoot}>
                <span className={styles.meta}>{voteLabel(t, total)}</span>
                {open ? (
                    viewer ? (
                        <form className={styles.suggestForm} onSubmit={suggest}>
                            <input
                                className={styles.input}
                                value={name}
                                maxLength={50}
                                placeholder={t('polls.suggestPlaceholder')}
                                aria-label={t('polls.suggestPlaceholder')}
                                onChange={(e) => {
                                    const { cleaned, found } = filterBadWords(e.target.value);
                                    if (found) onFiltered();
                                    setName(cleaned);
                                }}
                            />
                            <button type="submit" className={styles.submit} disabled={busy || !name.trim()}>
                                {t('polls.suggest')}
                            </button>
                        </form>
                    ) : (
                        <span className={styles.meta}>
                            <a
                                href={`/api/auth/discord/login?next=${encodeURIComponent('/polls')}`}
                                className={styles.link}
                            >
                                {t('polls.signIn')}
                            </a>{' '}
                            {t('polls.signInHint')}
                        </span>
                    )
                ) : null}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            {notice ? <p className={styles.notice}>{notice}</p> : null}
        </article>
    );
}

export default function PollsPage() {
    const t = useTranslation();
    const [polls, setPolls] = React.useState(null);
    const [viewer, setViewer] = React.useState(null);
    const [error, setError] = React.useState(null);
    // Bad-word feedback, shared by every card: the same red X flash the
    // builder's name inputs show. Rendered at the page root (inside the zoomed
    // site content), so the fixed overlay centres exactly like the builder's.
    const [showRedX, setShowRedX] = React.useState(false);
    const redXTimeout = React.useRef(null);
    React.useEffect(() => () => clearTimeout(redXTimeout.current), []);
    function triggerRedX() {
        setShowRedX(true);
        if (redXTimeout.current) clearTimeout(redXTimeout.current);
        redXTimeout.current = setTimeout(() => setShowRedX(false), 1600);
    }

    React.useEffect(() => {
        let cancelled = false;
        fetch('/api/v2/polls')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((data) => {
                if (cancelled) return;
                setPolls(data.polls || []);
                setViewer(data.viewer || null);
            })
            .catch(() => !cancelled && setError(t('polls.loadError')));
        return () => {
            cancelled = true;
        };
    }, [t]);

    const updatePoll = React.useCallback((updated) => {
        setPolls((list) => (list || []).map((poll) => (poll.id === updated.id ? updated : poll)));
    }, []);

    const openPolls = (polls || []).filter((poll) => poll.status === 'open');
    const closedPolls = (polls || []).filter((poll) => poll.status !== 'open');

    return (
        <div className={itemsStyles.container}>
            <main className={itemsStyles.main}>
                <h1>
                    {t('polls.title')}{' '}
                    <span className={styles.experimentalBadge}>{t('items.changes.experimental')}</span>
                </h1>
                {error ? <p className={styles.error}>{error}</p> : null}
                {polls === null && !error ? (
                    <p className={styles.muted}>
                        <SpookyArt
                            name="spooky_assets_0010"
                            width={128}
                            style={{ display: 'block', margin: '0 auto 10px' }}
                        />
                        {t('polls.loading')}
                    </p>
                ) : polls && polls.length === 0 ? (
                    <div className={itemsStyles.emptyState}>
                        <SpookyArt
                            name="spooky_assets_0011"
                            width={128}
                            style={{ display: 'block', margin: '0 auto 10px' }}
                        />
                        <b>{t('polls.empty')}</b>
                    </div>
                ) : (
                    <div className={styles.stack}>
                        {openPolls.map((poll) => (
                            <PollCard
                                key={poll.id}
                                poll={poll}
                                viewer={viewer}
                                onUpdated={updatePoll}
                                onFiltered={triggerRedX}
                            />
                        ))}
                        {openPolls.length > 0 && closedPolls.length > 0 ? (
                            <h2 className={styles.sectionTitle}>{t('polls.pastPolls')}</h2>
                        ) : null}
                        {closedPolls.map((poll) => (
                            <PollCard
                                key={poll.id}
                                poll={poll}
                                viewer={viewer}
                                onUpdated={updatePoll}
                                onFiltered={triggerRedX}
                            />
                        ))}
                    </div>
                )}
            </main>
            {showRedX && <img src="/images/redx.png" className={itemsStyles.redXOverlay} alt="" />}
        </div>
    );
}
