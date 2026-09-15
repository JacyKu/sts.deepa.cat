'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import styles from '../styles/Footer.module.css';
import LanguageSelector from './languageSelector';
import { useTranslation } from './useTranslation';
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
    const t = useTranslation();
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

    // The dialog must render OUTSIDE the footer: the footer's backdrop-filter
    // makes it a containing block, so a position:fixed overlay nested inside
    // it would anchor to the footer (landing far below the viewport) instead
    // of the screen. Portaled to <body>, it overlays the whole page.
    return (
        <>
            <footer className={styles.footer}>
                <div className={styles.inner}>
                    <div className={styles.text}>
                        {t('footer.forkedBy')} <b>jkitter</b>, {t('footer.originallyDevelopedBy')} <b>Albin</b>,{' '}
                        <b>FlamingoBike</b> {t('footer.and')} <b>Alecaboo</b>
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
                            {t('footer.helpTranslate')}
                        </a>
                        <button className={styles.textLink} onClick={openInvite}>
                            {t('footer.discordBot')}
                        </button>
                        <Link className={styles.textLink} href="/privacy">
                            {t('footer.privacyPolicy')}
                        </Link>
                        <Link className={styles.textLink} href="/terms">
                            {t('footer.terms')}
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
                        <a
                            className={styles.link}
                            href="#top"
                            aria-label={t('footer.backToTop')}
                            title={t('footer.backToTop')}
                        >
                            <ArrowUpIcon />
                        </a>
                    </div>
                </div>
            </footer>
            {inviteOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className={styles.overlay} onClick={() => setInviteOpen(false)}>
                        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalTitle}>{t('footer.inviteBotTitle')}</div>
                            {inviteUrls ? (
                                <>
                                    <p className={styles.modalText}>{t('footer.inviteBotDescription')}</p>
                                    <a
                                        className={styles.textLink}
                                        href={inviteUrls.serverUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {t('footer.addToServer')}
                                    </a>
                                    <a
                                        className={styles.textLink}
                                        href={inviteUrls.userUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {t('footer.installAsApp')}
                                    </a>
                                </>
                            ) : (
                                <p className={styles.modalText}>{t('footer.inviteNotConfigured')}</p>
                            )}
                            <button className={styles.modalClose} onClick={() => setInviteOpen(false)}>
                                {t('common.close')}
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
