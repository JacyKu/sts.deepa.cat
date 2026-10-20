'use client';

import React from 'react';
import styles from '../styles/SpookyEnding.module.css';
import { useTranslation } from './useTranslation';

// The one-time "End Halloween?" prompt. Confirming hides the decorations in
// this browser and plays the Deltarune explosion over every piece of Spooky
// Month art on the current page.
const EXPLOSION_SRC = '/images/deltarune_explosion.gif';
const ART_SELECTOR = 'img[src*="/images/scarlet_art/spooky_month/"]';
// 17 frames at 100ms. The GIF loops forever, so the overlays are removed just
// before it wraps - otherwise the first explosion frame flashes again after
// the animation looks finished.
const EXPLOSION_MS = 1600;

function reducedMotion() {
    if (typeof window === 'undefined') return true;
    return (
        document.documentElement.getAttribute('data-motion') === 'off' ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );
}

export default function SpookyEnding({ ended, onConfirm }) {
    const t = useTranslation();
    const [bursts, setBursts] = React.useState(null);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
        // Warm the gif while the prompt is up, so the explosion starts on the
        // first frame when the button is pressed.
        const image = new Image();
        image.src = EXPLOSION_SRC;
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    function confirm() {
        // Measure the art before the confirmation hides it. Offscreen pieces
        // get an explosion too; if every piece is offscreen, one burst in the
        // middle of the viewport makes sure the farewell is actually seen.
        const rects = [];
        document.querySelectorAll(ART_SELECTOR).forEach((image) => {
            const rect = image.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                rects.push({
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                });
            }
        });
        const onScreen = rects.some(
            (rect) =>
                rect.top < window.innerHeight &&
                rect.top + rect.height > 0 &&
                rect.left < window.innerWidth &&
                rect.left + rect.width > 0
        );
        const effect = !reducedMotion() && rects.length > 0;
        if (effect) {
            setBursts(
                onScreen
                    ? rects
                    : [
                          {
                              left: window.innerWidth / 2 - 80,
                              top: window.innerHeight / 2 - 110,
                              width: 160,
                              height: 220,
                          },
                      ]
            );
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                setBursts(null);
            }, EXPLOSION_MS);
        }
        onConfirm();
    }

    if (ended) {
        if (!bursts) return null;
        return (
            <div className={styles.explosions} aria-hidden="true">
                {bursts.map((rect, index) => (
                    <img
                        key={index}
                        src={EXPLOSION_SRC}
                        alt=""
                        className={styles.explosion}
                        style={{
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="spooky-ending-title">
            <div className={styles.modal}>
                <h2 className={styles.title} id="spooky-ending-title">
                    {t('spooky.endTitle')}
                </h2>
                <button type="button" className={styles.confirm} onClick={confirm} autoFocus>
                    {t('spooky.endConfirm')}
                </button>
            </div>
        </div>
    );
}
