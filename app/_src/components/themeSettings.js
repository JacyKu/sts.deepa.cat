'use client';

// Site look state shared by the header (which renders the glass backdrop)
// and the account page's Theme section (the only place themes are chosen).
// Themes are a base/colour choice (dark, white) plus the glass styling on
// top of either; rounded corners are an independent styling toggle, and the
// glass backdrop has its own colour scheme + extras. Everything is mirrored
// onto <html> attributes (data-theme, data-round, data-glass-*) and
// localStorage so every component and CSS rule reads one source of truth.

export const THEME_VALUES = ['dark', 'light', 'glass', 'glass-light'];
export const THEME_LABELS = {
    dark: 'Dark',
    light: 'White',
    glass: 'Glass',
    'glass-light': 'White Glass',
};

export const isGlassTheme = (theme) => theme === 'glass' || theme === 'glass-light';

// A user-defined backdrop: one colour, or several colours spread as a
// gradient (blob glows sample the gradient; flag mode paints it directly).
// Colours are plain #rrggbb hex strings, stored as a JSON array.
export const CUSTOM_SCHEME = 'custom';
export const DEFAULT_GLASS_CUSTOM_COLORS = ['#9c59d1'];
export const MAX_GLASS_CUSTOM_COLORS = 6;

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 'transparent';
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

// Sanitizes user-provided custom colours to a 1..MAX list of valid hexes.
export function sanitizeCustomColors(value) {
    const colors = Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',') : [];
    const clean = colors
        .filter((c) => HEX_RE.test(String(c)))
        .slice(0, MAX_GLASS_CUSTOM_COLORS)
        .map(String);
    return clean.length ? clean : [...DEFAULT_GLASS_CUSTOM_COLORS];
}

// Lerp two #rrggbb hexes (0..1) - used to sample the custom gradient.
export function hexLerp(a, b, t) {
    const pa = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(a);
    const pb = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(b);
    if (!pa || !pb) return a;
    const mix = (x, y) => Math.round(x + (y - x) * t);
    const r = mix(parseInt(pa[1], 16), parseInt(pb[1], 16));
    const g = mix(parseInt(pa[2], 16), parseInt(pb[2], 16));
    const bl = mix(parseInt(pa[3], 16), parseInt(pb[3], 16));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// Sample the custom colour gradient at t in [0,1].
export function customGradientSample(colors, t) {
    if (colors.length === 1 || t <= 0) return colors[0];
    if (t >= 1) return colors[colors.length - 1];
    const scaled = t * (colors.length - 1);
    const i = Math.floor(scaled);
    return hexLerp(colors[i], colors[i + 1], scaled - i);
}

// The four glow colors for a custom backdrop: samples along the picked
// gradient with alternating translucency, like the preset schemes. Light
// glass gets boosted alphas.
export function customBackdropColors(light, colors) {
    const alphas = light ? [0.68, 0.56, 0.75, 0.5] : [0.4, 0.3, 0.45, 0.26];
    const ts = [0, 0.4, 0.6, 1];
    return alphas.map((a, i) => hexToRgba(customGradientSample(colors, ts[i]), a));
}

// The OS-level preference, used only when nothing has been chosen yet.
export function systemTheme() {
    if (typeof window === 'undefined') return 'dark';
    try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch (e) {
        // ignore
    }
    return 'dark';
}

// Backdrop colour schemes for the glass themes (settings -> the colour list
// on the account page): pride flags plus a single hue each.
export const GLASS_SCHEMES = [
    'enby',
    'trans',
    'rainbow',
    'gay',
    'lesbian',
    'bi',
    'pan',
    'genderfluid',
    'aroace',
    'aro',
    'ace',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
];

// The single-hue schemes are plain colours; everything else is a pride flag.
// Kept as separate lists so the account page can present them in groups.
export const GLASS_BASIC_SCHEMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const GLASS_PRIDE_SCHEMES = GLASS_SCHEMES.filter((s) => !GLASS_BASIC_SCHEMES.includes(s));

// Schemes whose full-page flag gradient is painted from CSS (globals.css).
// Anything newer falls back to an inline gradient built from the blob
// colors, so the flag view works for every scheme.
export const GLASS_FLAG_CSS_SCHEMES = [
    'enby',
    'trans',
    'rainbow',
    'gay',
    'lesbian',
    'bi',
    'pan',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
];

// Blob colors per scheme, matching the flags (top stripe color first).
// Kept slightly translucent so the page content stays readable on top.
// Basic colors use a single hue with varied alphas.
export const GLASS_COLORS = {
    enby: [
        'rgba(252, 244, 49, 0.4)',
        'rgba(255, 255, 255, 0.32)',
        'rgba(156, 89, 209, 0.45)',
        'rgba(252, 244, 49, 0.24)',
    ],
    trans: [
        'rgba(91, 206, 250, 0.4)',
        'rgba(245, 169, 184, 0.36)',
        'rgba(255, 255, 255, 0.32)',
        'rgba(91, 206, 250, 0.28)',
    ],
    rainbow: ['rgba(228, 3, 3, 0.4)', 'rgba(255, 237, 0, 0.32)', 'rgba(36, 64, 142, 0.4)', 'rgba(0, 128, 38, 0.32)'],
    gay: ['rgba(7, 141, 112, 0.4)', 'rgba(255, 255, 255, 0.32)', 'rgba(80, 73, 204, 0.4)', 'rgba(38, 206, 170, 0.32)'],
    lesbian: [
        'rgba(239, 118, 39, 0.4)',
        'rgba(255, 255, 255, 0.32)',
        'rgba(163, 2, 98, 0.4)',
        'rgba(209, 98, 164, 0.32)',
    ],
    bi: ['rgba(214, 2, 112, 0.4)', 'rgba(155, 79, 150, 0.36)', 'rgba(0, 56, 168, 0.4)', 'rgba(214, 2, 112, 0.28)'],
    pan: ['rgba(255, 28, 142, 0.4)', 'rgba(255, 215, 0, 0.36)', 'rgba(26, 179, 255, 0.4)', 'rgba(255, 28, 142, 0.28)'],
    genderfluid: [
        'rgba(255, 118, 164, 0.4)',
        'rgba(255, 255, 255, 0.32)',
        'rgba(192, 17, 215, 0.45)',
        'rgba(51, 69, 139, 0.34)',
    ],
    aroace: [
        'rgba(234, 140, 69, 0.4)',
        'rgba(251, 207, 62, 0.34)',
        'rgba(121, 199, 197, 0.4)',
        'rgba(44, 115, 156, 0.42)',
    ],
    aro: [
        'rgba(61, 165, 66, 0.4)',
        'rgba(167, 211, 121, 0.32)',
        'rgba(255, 255, 255, 0.3)',
        'rgba(169, 169, 169, 0.4)',
    ],
    ace: ['rgba(0, 0, 0, 0.5)', 'rgba(164, 164, 164, 0.35)', 'rgba(255, 255, 255, 0.3)', 'rgba(129, 0, 129, 0.45)'],
    red: ['rgba(228, 3, 3, 0.4)', 'rgba(228, 3, 3, 0.32)', 'rgba(228, 3, 3, 0.45)', 'rgba(228, 3, 3, 0.24)'],
    orange: ['rgba(255, 140, 0, 0.4)', 'rgba(255, 140, 0, 0.32)', 'rgba(255, 140, 0, 0.45)', 'rgba(255, 140, 0, 0.24)'],
    yellow: ['rgba(255, 215, 0, 0.4)', 'rgba(255, 215, 0, 0.32)', 'rgba(255, 215, 0, 0.45)', 'rgba(255, 215, 0, 0.24)'],
    green: ['rgba(0, 128, 38, 0.4)', 'rgba(0, 128, 38, 0.32)', 'rgba(0, 128, 38, 0.45)', 'rgba(0, 128, 38, 0.24)'],
    blue: ['rgba(37, 99, 235, 0.4)', 'rgba(37, 99, 235, 0.32)', 'rgba(37, 99, 235, 0.45)', 'rgba(37, 99, 235, 0.24)'],
    purple: [
        'rgba(156, 89, 209, 0.4)',
        'rgba(156, 89, 209, 0.32)',
        'rgba(156, 89, 209, 0.45)',
        'rgba(156, 89, 209, 0.24)',
    ],
};
// The same glow colors, boosted for the White Glass theme: the light body
// background washes the low-alphas out, so each color gets ~+0.3 alpha to
// read as strongly on white as it does on the dark backdrop.
export const GLASS_COLORS_LIGHT = {
    enby: [
        'rgba(252, 244, 49, 0.68)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(156, 89, 209, 0.75)',
        'rgba(252, 244, 49, 0.42)',
    ],
    trans: [
        'rgba(91, 206, 250, 0.68)',
        'rgba(245, 169, 184, 0.62)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(91, 206, 250, 0.46)',
    ],
    rainbow: ['rgba(228, 3, 3, 0.68)', 'rgba(255, 237, 0, 0.55)', 'rgba(36, 64, 142, 0.68)', 'rgba(0, 128, 38, 0.55)'],
    gay: [
        'rgba(7, 141, 112, 0.68)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(80, 73, 204, 0.68)',
        'rgba(38, 206, 170, 0.55)',
    ],
    lesbian: [
        'rgba(239, 118, 39, 0.68)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(163, 2, 98, 0.68)',
        'rgba(209, 98, 164, 0.55)',
    ],
    bi: ['rgba(214, 2, 112, 0.68)', 'rgba(155, 79, 150, 0.62)', 'rgba(0, 56, 168, 0.68)', 'rgba(214, 2, 112, 0.46)'],
    pan: [
        'rgba(255, 28, 142, 0.68)',
        'rgba(255, 215, 0, 0.62)',
        'rgba(26, 179, 255, 0.68)',
        'rgba(255, 28, 142, 0.46)',
    ],
    genderfluid: [
        'rgba(255, 118, 164, 0.68)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(192, 17, 215, 0.75)',
        'rgba(51, 69, 139, 0.62)',
    ],
    aroace: [
        'rgba(234, 140, 69, 0.68)',
        'rgba(251, 207, 62, 0.6)',
        'rgba(121, 199, 197, 0.68)',
        'rgba(44, 115, 156, 0.7)',
    ],
    aro: [
        'rgba(61, 165, 66, 0.68)',
        'rgba(167, 211, 121, 0.58)',
        'rgba(255, 255, 255, 0.55)',
        'rgba(169, 169, 169, 0.68)',
    ],
    ace: ['rgba(0, 0, 0, 0.78)', 'rgba(164, 164, 164, 0.6)', 'rgba(255, 255, 255, 0.55)', 'rgba(129, 0, 129, 0.75)'],
    red: ['rgba(228, 3, 3, 0.68)', 'rgba(228, 3, 3, 0.55)', 'rgba(228, 3, 3, 0.75)', 'rgba(228, 3, 3, 0.42)'],
    orange: [
        'rgba(255, 140, 0, 0.68)',
        'rgba(255, 140, 0, 0.55)',
        'rgba(255, 140, 0, 0.75)',
        'rgba(255, 140, 0, 0.42)',
    ],
    yellow: [
        'rgba(255, 215, 0, 0.68)',
        'rgba(255, 215, 0, 0.55)',
        'rgba(255, 215, 0, 0.75)',
        'rgba(255, 215, 0, 0.42)',
    ],
    green: ['rgba(0, 128, 38, 0.68)', 'rgba(0, 128, 38, 0.55)', 'rgba(0, 128, 38, 0.75)', 'rgba(0, 128, 38, 0.42)'],
    blue: ['rgba(37, 99, 235, 0.68)', 'rgba(37, 99, 235, 0.55)', 'rgba(37, 99, 235, 0.75)', 'rgba(37, 99, 235, 0.42)'],
    purple: [
        'rgba(156, 89, 209, 0.68)',
        'rgba(156, 89, 209, 0.55)',
        'rgba(156, 89, 209, 0.75)',
        'rgba(156, 89, 209, 0.42)',
    ],
};

// Solid chip colors (flag stripe approximations, left to right) for the
// account page's colour list previews.
export const GLASS_CHIPS = {
    enby: ['#fcf431', '#fcf431', '#ffffff', '#9c59d1', '#2d2d2d'],
    trans: ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa'],
    rainbow: ['#e40303', '#ff8c00', '#ffed00', '#008026', '#24408e', '#732982'],
    gay: ['#078d70', '#26ceae', '#98e8c1', '#7bade2', '#5049cc', '#38d6aa'],
    lesbian: ['#d52d00', '#ef7627', '#ff9a56', '#ffffff', '#d162a4', '#b55690', '#a30262'],
    bi: ['#d60270', '#d60270', '#9b4f96', '#0038a8', '#0038a8'],
    pan: ['#ff1c8e', '#ffd700', '#1ab3ff'],
    genderfluid: ['#ff76a4', '#ffffff', '#c011d7', '#2d2d2d', '#33458b'],
    aroace: ['#ea8c45', '#fbcf3e', '#ffffff', '#79c7c5', '#2c739c'],
    aro: ['#3da542', '#a7d379', '#ffffff', '#a9a9a9', '#000000'],
    ace: ['#000000', '#a4a4a4', '#ffffff', '#810081'],
    red: ['#e40303', '#e40303', '#e40303'],
    orange: ['#ff8c00', '#ff8c00', '#ff8c00'],
    yellow: ['#ffd700', '#ffd700', '#ffd700'],
    green: ['#008026', '#008026', '#008026'],
    blue: ['#2563eb', '#2563eb', '#2563eb'],
    purple: ['#9c59d1', '#9c59d1', '#9c59d1'],
};

export const glassSchemeLabel = (scheme) => (scheme ? scheme.charAt(0).toUpperCase() + scheme.slice(1) : '');

const readStored = (key) => {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
};

// Read the full look state from localStorage, falling back to the <html>
// attributes (already applied by another component this session).
export function readThemeState() {
    let theme = null;
    let round = null;
    let glassScheme = null;
    let glassAnim = null;
    let glassFlag = null;
    let glassCustom = null;
    if (typeof window !== 'undefined') {
        theme = readStored('theme');
        round = readStored('roundStyle');
        glassScheme = readStored('glassScheme');
        glassAnim = readStored('glassAnim');
        glassFlag = readStored('glassFlag');
        glassCustom = readStored('glassCustom');
    }
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const attrTheme = root ? root.dataset.theme : null;
    if (attrTheme === 'round' || theme === 'round') {
        // Legacy 'round' theme (pre-toggle): dark base + rounded corners.
        theme = 'dark';
        round = '1';
    }
    if (!THEME_VALUES.includes(theme)) theme = THEME_VALUES.includes(attrTheme) ? attrTheme : systemTheme();
    const roundOn = round === '1' || (root && root.dataset.round === 'true');
    const validScheme = (s) => s === CUSTOM_SCHEME || GLASS_SCHEMES.includes(s);
    const attrScheme = root && validScheme(root.dataset.glassScheme) ? root.dataset.glassScheme : null;
    const scheme = validScheme(glassScheme) ? glassScheme : attrScheme || 'enby';
    let customColors = null;
    try {
        if (glassCustom) customColors = JSON.parse(glassCustom);
    } catch (e) {
        customColors = null;
    }
    if (!Array.isArray(customColors) || customColors.length === 0) {
        // Legacy pair of keys (glassCustom1/glassCustom2) from before
        // arbitrary-length custom gradients.
        const c1 = readStored('glassCustom1');
        const c2 = readStored('glassCustom2');
        if (c1 || c2) customColors = [c1, c2];
    }
    customColors = sanitizeCustomColors(customColors);
    return {
        theme,
        round: roundOn,
        glassScheme: scheme,
        glassAnim: glassAnim === 'true' || (root && root.dataset.glassAnim === 'true'),
        glassFlag: glassFlag === 'true' || (root && root.dataset.glassFlag === 'true'),
        glassCustom: customColors,
    };
}

// Persist part of the look state and mirror it onto <html>. Only the
// provided fields change; the rest keep their current attribute values.
export function applyThemeState(changes) {
    const root = document.documentElement;
    const current = readThemeState();
    const next = { ...current, ...changes };
    root.dataset.theme = next.theme;
    if (next.round) root.dataset.round = 'true';
    else delete root.dataset.round;
    if (next.glassScheme) root.dataset.glassScheme = next.glassScheme;
    if (next.glassAnim) root.dataset.glassAnim = 'true';
    else delete root.dataset.glassAnim;
    if (next.glassFlag) root.dataset.glassFlag = 'true';
    else delete root.dataset.glassFlag;
    try {
        localStorage.setItem('theme', next.theme);
        localStorage.setItem('roundStyle', next.round ? '1' : '0');
        localStorage.setItem('glassScheme', next.glassScheme);
        localStorage.setItem('glassAnim', String(next.glassAnim));
        localStorage.setItem('glassFlag', String(next.glassFlag));
        localStorage.setItem('glassCustom', JSON.stringify(sanitizeCustomColors(next.glassCustom)));
    } catch (e) {
        // ignore
    }
    // Components (the header's glass backdrop) that cached the old state
    // re-sync from the attributes.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sts-theme-change'));
}
