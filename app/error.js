'use client';

import { useEffect } from 'react';
import { useTranslation } from './_src/components/useTranslation';

// Catch-all for uncaught errors while rendering a page (a data file that
// cannot be read, an unexpected bug). Without it Next shows its own crash
// screen; here the site stays usable and offers a retry.
export default function Error({ error, reset }) {
    const t = useTranslation();

    useEffect(() => {
        console.error('[page] render failed:', error);
    }, [error]);

    return (
        <main
            className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center"
            style={{ backgroundColor: '#000', minHeight: '100vh' }}
        >
            <img src="/images/redx.png" alt="" width={96} height={96} style={{ imageRendering: 'pixelated' }} />
            <h1 className="mt-6 text-4xl font-bold" style={{ color: '#fff' }}>
                {t('error.title')}
            </h1>
            <p className="mt-3 text-lg" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {t('error.description')}
            </p>
            <button
                type="button"
                onClick={() => reset()}
                className="mt-6 px-5 py-2 text-base font-semibold"
                style={{
                    backgroundColor: '#9c59d1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                }}
            >
                {t('error.retry')}
            </button>
        </main>
    );
}
