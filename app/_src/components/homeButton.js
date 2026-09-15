'use client';

import styles from '../styles/HomeButton.module.css';
import Link from 'next/link';
import { getStsBase } from '../utils/base';
import { useTranslation } from './useTranslation';

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="50" height="50" fill="currentColor" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
    );
}

export default function HomeButton() {
    const t = useTranslation();
    return (
        <div className={styles.homebutton} title={t('header.goToHomepage')}>
            <Link href={getStsBase() + '/'} className={styles.button}>
                <HomeIcon />
            </Link>
        </div>
    );
}
