'use client';

import { useEffect, useLayoutEffect } from 'react';
import './globals.css';
import { readThemeState } from './_src/components/themeSettings';

// Last-resort boundary: catches errors thrown by the root layout itself,
// where the site's providers (and translations) are not available yet. It
// must render its own <html>/<body>, and - since the layout's header never
// runs here - it applies the stored theme itself so the screen still matches
// the visitor's look.
export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error('[app] root layout failed:', error);
    }, [error]);

    useLayoutEffect(() => {
        try {
            const state = readThemeState();
            const root = document.documentElement;
            root.dataset.theme = state.theme;
            if (state.round) root.dataset.round = 'true';
            else delete root.dataset.round;
            root.style.setProperty('--round-radius', `${state.roundRadius}px`);
        } catch (e) {
            // Storage unavailable - the default theme applies.
        }
    }, []);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    backgroundColor: 'var(--bg-0)',
                    color: 'var(--text-1)',
                    fontFamily: 'sans-serif',
                }}
            >
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
                    <p style={{ marginTop: 12, color: 'var(--text-2)' }}>
                        Spare the Sympathy ran into an unexpected error. Reloading usually fixes it.
                    </p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        style={{
                            marginTop: 24,
                            padding: '8px 20px',
                            backgroundColor: 'var(--accent)',
                            color: 'var(--text-on-accent)',
                            border: 'none',
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
