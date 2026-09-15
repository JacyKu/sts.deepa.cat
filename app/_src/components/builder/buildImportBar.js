'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../styles/Items.module.css';
import { getStsBase } from '../../utils/base';
import { encodeBuildParam } from '../../utils/builder/buildUrlCodec';
import { useTranslation } from '../useTranslation';

function parseImportedBuild(raw) {
    let str = String(raw || '').trim();
    if (!str) return null;
    try {
        if (str.includes('?build=')) {
            const qIdx = str.indexOf('?');
            const paramStr = str.slice(qIdx + 1);
            const params = new URLSearchParams(paramStr);
            str = params.get('build') || '';
            if (!(str.includes('=') && str.includes('&')) && paramStr.includes('=')) {
                // legacy query was spread across raw params (build=m=A&o=B style)
                str = paramStr.replace(/^build=/, '');
            }
        } else if (/^https?:\/\//i.test(str)) {
            const idx = str.lastIndexOf('/builder');
            if (idx === -1) return null;
            str = str.slice(idx + '/builder'.length);
            str = str.replace(/^[/?]/, '');
            const qIdx = str.indexOf('?');
            if (qIdx !== -1) str = str.slice(0, qIdx);
            const fIdx = str.indexOf('#');
            if (fIdx !== -1) str = str.slice(0, fIdx);
        }
        str = decodeURIComponent(str);
    } catch (e) {
        return null;
    }
    str = str.trim();
    const valid = str.startsWith('v1_') || str.startsWith('z:') || (str.includes('=') && str.includes('&'));
    return valid ? str : null;
}

export default function BuildImportBar({ embedded }) {
    const router = useRouter();
    const t = useTranslation();
    const [value, setValue] = React.useState('');
    const [error, setError] = React.useState(false);

    function handleImport() {
        const buildString = parseImportedBuild(value);
        if (!buildString) {
            setError(true);
            return;
        }
        setError(false);
        setValue('');
        router.replace(getStsBase() + '/builder/' + encodeBuildParam(buildString));
    }

    if (embedded) {
        const [open, setOpen] = React.useState(false);
        return (
            <div className={styles.importWrap}>
                <button
                    type="button"
                    className={styles.importMenuBtn}
                    onClick={() => setOpen((o) => !o)}
                    aria-label={t('builder.importBar.importLink')}
                    aria-expanded={open}
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                        <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
                    </svg>
                </button>
                {open && <div className={styles.importBackdrop} onClick={() => setOpen(false)} />}
                <div className={`${styles.importPanel}${open ? ` ${styles.importPanelOpen}` : ''}`}>
                    <div className={styles.importRow}>
                        <input
                            type="text"
                            className={styles.importInput}
                            placeholder="https://odetomisery.vercel.app/builder/..."
                            aria-label={t('builder.importBar.importLink')}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setError(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleImport();
                            }}
                            spellCheck="false"
                        />
                        <button type="button" className={styles.importButton} onClick={handleImport}>
                            {t('builder.buttons.import')}
                        </button>
                    </div>
                    {error && <div className={styles.importError}>{t('builder.errors.couldNotReadBuildLink')}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="row mb-4">
            <div className="col-12 d-flex justify-content-center">
                <div style={{ width: 'min(620px, 100%)' }}>
                    <div className={styles.importRow}>
                        <input
                            type="text"
                            className={styles.importInput}
                            placeholder="https://odetomisery.vercel.app/builder/..."
                            aria-label={t('builder.importBar.importLink')}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setError(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleImport();
                            }}
                            spellCheck="false"
                        />
                        <button type="button" className={styles.importButton} onClick={handleImport}>
                            {t('builder.buttons.import')}
                        </button>
                    </div>
                    {error && <div className={styles.importError}>{t('builder.errors.couldNotReadBuildLink')}</div>}
                </div>
            </div>
        </div>
    );
}
