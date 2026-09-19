'use client';

import React from 'react';
import styles from '../styles/NotificationsBar.module.css';
import { useTranslation } from './useTranslation';

// Fixed warning shown on every page of non-production deployments (dev box,
// localhost, Cloudflare Pages previews). Rendered in the same banner style
// as the bot-posted notifications but intentionally has no dismiss button:
// testers should always be able to tell which site they are on.
const PROD_HOSTS = new Set(['sts.deepa.cat', 'www.sts.deepa.cat']);

function isDevSite() {
    if (typeof window === 'undefined') return false;
    return !PROD_HOSTS.has(window.location.hostname.toLowerCase());
}

export default function DevSiteBanner() {
    const t = useTranslation();
    const [dev, setDev] = React.useState(false);

    React.useEffect(() => {
        setDev(isDevSite());
    }, []);

    if (!dev) return null;

    return (
        <div className={styles.list}>
            <div className={`${styles.banner} ${styles.warning}`} role="alert">
                <span className={styles.message}>
                    {t('header.devSiteBeforeLink')}{' '}
                    <a className={styles.devLink} href="https://sts.deepa.cat" target="_blank" rel="noreferrer">
                        sts.deepa.cat
                    </a>{' '}
                    {t('header.devSiteAfterLink')}
                </span>
            </div>
        </div>
    );
}
