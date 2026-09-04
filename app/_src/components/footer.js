'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from '../styles/Footer.module.css';
import LanguageSelector from './languageSelector';
import pkg from '../../../package.json';

function GitHubIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
        </svg>
    );
}

function ArrowUpIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
    );
}

export default function Footer() {
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteUrls, setInviteUrls] = useState(null);
    const [inviteFailed, setInviteFailed] = useState(false);

    function openInvite() {
        if (!inviteUrls && !inviteFailed) {
            fetch('/api/bot/invite')
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not ok'))))
                .then((d) => setInviteUrls(d))
                .catch(() => setInviteFailed(true));
        }
        setInviteOpen(true);
    }

    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <div className={styles.text}>
                    Forked by <b>JC</b>, originally developed by <b>Albin</b>, <b>FlamingoBike</b> and <b>Alecaboo</b>
                    <span className={styles.version}> · v{pkg.sts_version}</span>
                </div>
                <div className={styles.links}>
                    <LanguageSelector className={styles.languageSelect} compact />
                    <a
                        className={styles.textLink}
                        href="https://crowdin.com/project/ohthemisery"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Help translate
                    </a>
                    <button className={styles.textLink} onClick={openInvite}>
                        Discord bot
                    </button>
                    <Link className={styles.textLink} href="/privacy">
                        Privacy Policy
                    </Link>
                    <Link className={styles.textLink} href="/terms">
                        Terms
                    </Link>
                    <a
                        className={styles.link}
                        href="https://github.com/JacyKu/sts.deepa.cat"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub"
                        title="GitHub"
                    >
                        <GitHubIcon />
                    </a>
                    <a className={styles.link} href="#top" aria-label="Back to top" title="Back to top">
                        <ArrowUpIcon />
                    </a>
                </div>
            </div>
            {inviteOpen ? (
                <div className={styles.overlay} onClick={() => setInviteOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>Invite the STS bot</div>
                        {inviteUrls ? (
                            <>
                                <p className={styles.modalText}>
                                    Add the bot to a server, or install it as your personal app so it works in your DMs.
                                </p>
                                <a
                                    className={styles.textLink}
                                    href={inviteUrls.serverUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Add to a server
                                </a>
                                <a
                                    className={styles.textLink}
                                    href={inviteUrls.userUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Install as your app
                                </a>
                            </>
                        ) : (
                            <p className={styles.modalText}>
                                The bot invite is not configured on this server. Try again later.
                            </p>
                        )}
                        <button className={styles.modalClose} onClick={() => setInviteOpen(false)}>
                            Close
                        </button>
                    </div>
                </div>
            ) : null}
        </footer>
    );
}
