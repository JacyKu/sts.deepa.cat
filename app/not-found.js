'use client';

import { useTranslation } from './_src/components/useTranslation';
import SpookyArt from './_src/components/spookyArt';
import { useSpookyTheme } from './_src/components/spookyThemeContext';

// 404 screen, themed with the active theme's tokens (the layout's header
// mirrors the stored theme onto <html>), so it matches the visitor's look
// instead of a fixed dark palette. The witch hat only shows while the Spooky
// Month theme is on; otherwise the original mascot image is used.
export default function NotFound() {
    const t = useTranslation();
    const spooky = useSpookyTheme();
    return (
        <main
            className="spooky-off relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center"
            style={{ minHeight: '100vh' }}
        >
            {spooky ? (
                <SpookyArt name="spooky_assets_0011" width={128} />
            ) : (
                <img
                    src="/images/404deepa.png"
                    alt="404"
                    width={128}
                    height={128}
                    style={{ imageRendering: 'pixelated' }}
                />
            )}
            <h1 className="mt-6 text-5xl font-bold" style={{ color: 'var(--text-1)' }}>
                404
            </h1>
            <p className="mt-3 text-lg" style={{ color: 'var(--text-2)' }}>
                {t('notFound.title')}
            </p>
        </main>
    );
}
