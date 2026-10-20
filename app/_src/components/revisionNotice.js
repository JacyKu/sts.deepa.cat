'use client';

import React from 'react';
import { useTranslation } from './useTranslation';
import styles from '../styles/Items.module.css';

export default function RevisionNotice({ requested, current, href }) {
    const t = useTranslation();
    return (
        <div className={styles.revisionNotice} role="status">
            <span>
                {t('builds.olderRevisionNotice').replace('{requested}', requested).replace('{current}', current)}
            </span>
            <a className={styles.revisionNoticeLink} href={href}>
                {t('builds.viewLatestRevision')}
            </a>
        </div>
    );
}
