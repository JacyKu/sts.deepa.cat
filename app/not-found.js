'use client';

import { useTranslation } from './_src/components/useTranslation';

export default function NotFound() {
    const t = useTranslation();
    return (
        <main
            className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center"
            style={{ backgroundColor: '#000', minHeight: '100vh' }}
        >
            <img
                src="/images/404deepa.png"
                alt="404"
                width={128}
                height={128}
                style={{ imageRendering: 'pixelated' }}
            />
            <h1 className="mt-6 text-5xl font-bold" style={{ color: '#fff' }}>
                404
            </h1>
            <p className="mt-3 text-lg" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {t('notFound.title')}
            </p>
        </main>
    );
}
