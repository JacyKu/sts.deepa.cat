'use client';

import React from 'react';
import styles from '../../styles/Sets.module.css';
import { formatDateString } from '../../utils/dateFormat';

const KIND_LABELS = {
    skills: 'Skill set',
    delve: 'Infusion set',
};

const SLOT_LABELS = {
    mainhand: 'Mainhand',
    offhand: 'Offhand',
    helmet: 'Helmet',
    chestplate: 'Chestplate',
    leggings: 'Leggings',
    boots: 'Boots',
};

function humanClass(cl) {
    if (!cl) return null;
    return cl.charAt(0).toUpperCase() + cl.slice(1);
}

function avatarSrc(set) {
    if (!set.authorAvatar || !set.userId) return null;
    if (String(set.authorAvatar).startsWith('http')) return set.authorAvatar;
    return `https://cdn.discordapp.com/avatars/${set.userId}/${set.authorAvatar}.png?size=32`;
}

// Public page for a shared skill/infusion set. Anyone with the link can view
// it and open it in the builder; only the owner can share or unshare it.
export default function SharedSetView({ set, detail }) {
    // The user's date-format preference lives in localStorage, so render the
    // date after mount to avoid a hydration mismatch with the server paint.
    const [updated, setUpdated] = React.useState('');
    React.useEffect(() => {
        if (set && set.updatedAt) setUpdated(formatDateString(set.updatedAt, { spaceToT: true }));
    }, [set]);

    if (!set) {
        return (
            <main className={styles.page}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Shared set</h1>
                    <p className={styles.muted}>This set does not exist or is no longer shared.</p>
                    <div className={styles.actions}>
                        <a className={styles.cta} href="/builder">
                            Open the builder
                        </a>
                    </div>
                </div>
            </main>
        );
    }

    const isDelve = set.kind === 'delve';
    const avatar = avatarSrc(set);

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <span className={styles.badge}>{KIND_LABELS[set.kind] || 'Set'}</span>
                <h1 className={styles.title}>{set.name}</h1>
                <p className={styles.muted}>
                    {isDelve
                        ? 'Delve infusions'
                        : `${humanClass(set.className) || 'Unknown class'}${set.spec ? ` / ${set.spec}` : ''}`}
                    {set.authorName ? ` · shared by ${set.authorName}` : ''}
                </p>

                {isDelve ? (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Infusions</h2>
                        {detail && detail.infusions.length > 0 ? (
                            <ul className={styles.list}>
                                {detail.infusions.map((entry) => (
                                    <li key={entry.slot} className={styles.row}>
                                        <span className={styles.slot}>{SLOT_LABELS[entry.slot] || entry.slot}</span>
                                        <span className={styles.name}>{entry.name}</span>
                                        <span className={styles.value}>
                                            {entry.level !== null ? `Level ${entry.level}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={styles.muted}>No infusions in this set.</p>
                        )}
                        {detail && detail.revelation && (
                            <div className={styles.chips}>
                                <span className={styles.chip}>Revelation</span>
                            </div>
                        )}
                    </section>
                ) : (
                    <>
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Skills</h2>
                            {detail && detail.skills.length > 0 ? (
                                <ul className={styles.list}>
                                    {detail.skills.map((entry) => (
                                        <li key={entry.name} className={styles.row}>
                                            <span className={styles.name}>{entry.name}</span>
                                            <span className={styles.value}>+{entry.points}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.muted}>No skill points in this set.</p>
                            )}
                        </section>
                        {detail && detail.specSkills.length > 0 && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Spec skills</h2>
                                <ul className={styles.list}>
                                    {detail.specSkills.map((entry) => (
                                        <li key={entry.name} className={styles.row}>
                                            <span className={styles.name}>{entry.name}</span>
                                            <span className={styles.value}>+{entry.points}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {detail && detail.enhanced.length > 0 && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Enhanced</h2>
                                <div className={styles.chips}>
                                    {detail.enhanced.map((name) => (
                                        <span key={name} className={styles.chip}>
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}
                        {detail && detail.cz.length > 0 && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Celestial Zenith</h2>
                                <div className={styles.chips}>
                                    {detail.cz.map((name) => (
                                        <span key={name} className={styles.chip}>
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                <div className={styles.actions}>
                    <a className={styles.cta} href={`/builder?set=${encodeURIComponent(set.id)}`}>
                        Open in builder
                    </a>
                </div>

                <div className={styles.footer}>
                    <span className={styles.author}>
                        {avatar && <img className={styles.avatar} src={avatar} alt="" width={18} height={18} />}
                        {set.authorName || 'a player'}
                    </span>
                    <span>{updated}</span>
                </div>
            </div>
        </main>
    );
}
