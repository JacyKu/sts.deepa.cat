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

function CurseForgeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M18.326 9.2145S23.2261 8.4418 24 6.1882h-7.5066V4.4H0l2.0318 2.3576V9.173s5.1267-.2665 7.1098 1.2372c2.7146 2.516-3.053 5.917-3.053 5.917L5.0995 19.6c1.5465-1.4726 4.494-3.3775 9.8983-3.2857-2.0565.65-4.1245 1.6651-5.7344 3.2857h10.9248l-1.0288-3.2726s-7.918-4.6688-.8336-7.1127z" />
        </svg>
    );
}

function DiscordIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
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
                        <Link className={styles.textLink} href="/privacy">
                            {t('footer.privacyPolicy')}
                        </Link>
                        <Link className={styles.textLink} href="/terms">
                            {t('footer.terms')}
                        </Link>
                        <button
                            className={styles.link}
                            onClick={openInvite}
                            aria-label="Discord"
                            title="Discord"
                        >
                            <DiscordIcon />
                        </button>
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
                            href="https://www.curseforge.com/minecraft/mc-mods/spare-the-sympathy"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="CurseForge"
                            title="CurseForge"
                        >
                            <CurseForgeIcon />
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
