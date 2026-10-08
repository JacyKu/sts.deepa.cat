'use client';

// Spooky Month corner decorations. Each page shows two pieces - one top and
// one bottom, always on opposite corners - picked deterministically from the
// page's path. Nothing is random: a page always shows the same pair, different
// pages get different pairs (repeats across pages are fine), and the whole set
// gets spread across the site. The landing, settings and account pages show
// none, the items page uses both top corners instead (no bottom), the builder
// both bottom corners instead (no top). The dragon is the only piece allowed
// to sit flush against the window edge.
import { usePathname } from 'next/navigation';
import SpookyArt from './spookyArt';
import { useSpookyTheme } from './spookyThemeContext';

const DRAGON = 'spooky_assets_0004';
const MOON = 'spooky_assets_0010';

const TOP = [{ name: MOON }, { name: 'spooky_assets_0005' }, { name: DRAGON }, { name: 'spooky_assets_0003' }];

const BOTTOM = [
    { name: 'spooky_assets_0002' },
    { name: 'spooky_assets_0007_1', width: 192, height: 96 },
    { name: 'spooky_assets_0007_2', width: 192, height: 96 },
];

// Stable per-path index (FNV-1a with an avalanche step): deterministic across
// reloads and between the server and the client, so the decoration never
// flickers or hydrates wrong, and neighbouring paths land on different picks.
function pathHash(path) {
    let h = 2166136261;
    for (let i = 0; i < path.length; i++) {
        h ^= path.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return h >>> 0;
}

export default function SpookyCorners() {
    const pathname = usePathname() || '/';
    const enabled = useSpookyTheme();
    const h = pathHash(pathname);

    if (!enabled) return null;

    let pieces;
    if (pathname === '/' || pathname === '/settings' || pathname === '/account') {
        // The landing, settings and account pages keep their own layouts only.
        pieces = [];
    } else if (pathname === '/items') {
        // Both top corners. The dragon is replaced by the moon cat here (it
        // may only ever sit on the right elsewhere, and never on this page).
        const itemsPool = TOP.map((p) => (p.name === DRAGON ? { name: MOON } : p));
        const left = itemsPool[h % itemsPool.length];
        const right = itemsPool[(h + 1) % itemsPool.length];
        pieces = [
            { ...left, side: 'tl' },
            { ...right, side: 'tr' },
        ];
    } else if (pathname.startsWith('/builder') || pathname.startsWith('/b/')) {
        // Bottom corners only: the builder tool layout owns the top edges
        // (both the /builder pages and the /b/<id> build views that render
        // the builder with a loaded build).
        const a = BOTTOM[h % BOTTOM.length];
        const b = BOTTOM[(h + 1) % BOTTOM.length];
        pieces = [
            { ...a, side: 'bl' },
            { ...b, side: 'br' },
        ];
    } else {
        const top = TOP[h % TOP.length];
        const bottom = BOTTOM[(h >>> 2) % BOTTOM.length];
        const topSide = top.name === DRAGON || ((h >>> 4) & 1) === 0 ? 'tr' : 'tl';
        const bottomSide = topSide === 'tr' ? 'bl' : 'br';
        pieces = [{ ...top, side: topSide, flush: top.name === DRAGON }];
        // The database page keeps its bottom-left slot clear.
        if (!(pathname === '/database' && bottomSide === 'bl')) {
            pieces.push({ ...bottom, side: bottomSide });
        }
    }

    return (
        <div className="spooky-corners" aria-hidden="true">
            {pieces.map((p) => (
                <SpookyArt
                    key={p.side}
                    name={p.name}
                    width={p.width || 128}
                    height={p.height || 128}
                    className={`spooky-corner-${p.side}${p.flush ? ' spooky-corner-flush' : ''}`}
                />
            ))}
        </div>
    );
}
