'use client';

import { useEffect } from 'react';

// Last-resort boundary: catches errors thrown by the root layout itself,
// where the site's providers (and translations) are not available yet. It
// must render its own <html>/<body>.
export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error('[app] root layout failed:', error);
    }, [error]);

    return (
        <html lang="en">
            <body style={{ margin: 0, backgroundColor: '#000', color: '#fff', fontFamily: 'sans-serif' }}>
                <main
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '0 24px',
                    }}
                >
                    <img src="/images/redx.png" alt="" width={96} height={96} style={{ imageRendering: 'pixelated' }} />
                    <h1 style={{ marginTop: 24, fontSize: 32 }}>Something went wrong</h1>
                    <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)' }}>
                        Spare the Sympathy ran into an unexpected error. Reloading usually fixes it.
                    </p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        style={{
                            marginTop: 24,
                            padding: '8px 20px',
                            backgroundColor: '#9c59d1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 16,
                        }}
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
