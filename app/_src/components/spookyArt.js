'use client';

import { useSpookyTheme } from './spookyThemeContext';

// Spooky Month artwork by scarlet (public/images/scarlet_art/spooky_month).
// Decorative only: always hidden from assistive tech, rendered with
// image-rendering: pixelated, and sized in multiples of 64 so the art stays
// crisp (the 640x640 sources use a 64x64 art grid - 10px per art pixel - so
// only integer multiples keep every art pixel the same size on screen).
// Renders nothing at all when the moderation theme toggle is off.
const BASE = '/images/scarlet_art/spooky_month';

// The 640x320 divider strips crop well with objectFit: 'cover' (a shorter
// display height trims the transparent padding above/below the artwork).
export default function SpookyArt({ name, width = 128, height = null, className, style }) {
    const enabled = useSpookyTheme();
    if (!enabled) return null;
    return (
        <img
            src={`${BASE}/${name}.png`}
            alt=""
            aria-hidden="true"
            width={width}
            height={height || width}
            className={className}
            style={{ imageRendering: 'pixelated', ...style }}
        />
    );
}
