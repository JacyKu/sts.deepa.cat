'use client';

import React from 'react';

// "Twisted lxxxxxxx" is the API's frozen frame of the game's <obfuscated>
// text: in-game it is a glyph scramble that changes every frame. These helpers
// render the redacted token the same way - each glyph re-rolled every 50ms
// (the game's tick rate) from the font's printable ASCII range, exactly the
// set Minecraft shuffles through (symbols, digits and letters alike).
export const OBFUSCATED_TOKEN_RE = /[A-Za-z]?x{4,}/g;
const SPLIT_RE = /([A-Za-z]?x{4,})/g;
const EXACT_RE = /^[A-Za-z]?x{4,}$/;

// '!' (33) through '~' (126): the vanilla character set for obfuscated text.
const GLYPHS = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).join('');
const TICK_MS = 50;

// One shared ticker and IntersectionObserver for every scramble on the page:
// offscreen tokens are dropped from the cycle (so long, scrolling item lists
// cost nothing), the ticker stops entirely when nothing visible remains or the
// tab is hidden, and the glyphs are written straight to the DOM through refs -
// no React re-renders while scrambling.
const visible = new Set();
let ticker = null;
let observer = null;

function randomGlyphs(length) {
    let out = '';
    for (let i = 0; i < length; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    return out;
}

function paint(span) {
    span.textContent = randomGlyphs(Number(span.dataset.obfuscatedLength) || 8);
}

function syncTicker() {
    const wanted = visible.size > 0 && typeof document !== 'undefined' && !document.hidden;
    if (wanted && !ticker) {
        ticker = setInterval(() => {
            for (const span of visible) paint(span);
        }, TICK_MS);
    } else if (!wanted && ticker) {
        clearInterval(ticker);
        ticker = null;
    }
}

function visibilityObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    visible.add(entry.target);
                    paint(entry.target);
                } else {
                    visible.delete(entry.target);
                }
            }
            syncTicker();
        },
        { rootMargin: '120px' }
    );
    document.addEventListener('visibilitychange', syncTicker);
    return observer;
}

function motionReduced() {
    return typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off';
}

// Layout safety: the original token stays in the flow (hidden) so line
// wrapping and card heights are exactly what they would be without the
// scramble, and the cycling glyphs paint on an absolutely positioned overlay
// that is out of flow - it can never reflow the line or grow the card. The
// overlay is centred on the token's box so its larger line box (leading
// included) keeps the glyphs on the token's baseline.
const WRAP_STYLE = { position: 'relative' };
const HIDDEN_STYLE = { visibility: 'hidden' };
const PAINT_STYLE = {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

// The scramble for one token. Starts as the token itself (server render safe,
// no hydration mismatch), then scrambles on mount.
export function ObfuscatedText({ text }) {
    const paintRef = React.useRef(null);
    useIsomorphicLayoutEffect(() => {
        const span = paintRef.current;
        if (!span) return undefined;
        paint(span);
        if (motionReduced()) return undefined;
        const obs = visibilityObserver();
        obs.observe(span);
        return () => {
            obs.unobserve(span);
            visible.delete(span);
            syncTicker();
        };
    }, [text]);
    return (
        <span aria-label={text} style={WRAP_STYLE}>
            <span aria-hidden="true" style={HIDDEN_STYLE}>
                {text}
            </span>
            <span ref={paintRef} data-obfuscated-length={text.length} aria-hidden="true" style={PAINT_STYLE}>
                {text}
            </span>
        </span>
    );
}

// Renders any string, swapping the obfuscated tokens for live scrambles.
// Returns the original string untouched when nothing matches.
export function renderObfuscated(text) {
    if (typeof text !== 'string' || !/[A-Za-z]?x{4,}/.test(text)) return text;
    return text.split(SPLIT_RE).map((part, i) => (EXACT_RE.test(part) ? <ObfuscatedText key={i} text={part} /> : part));
}
