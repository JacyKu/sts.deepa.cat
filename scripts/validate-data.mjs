// Read-only consistency check for the committed item + spritesheet data.
//
// Catches the "replacing files causes issues" class of bugs (e.g. a stale
// _itemsheet.css mixed with a newer itemsheet-map.json, which made animated
// sprites slide): every token the site can map to must have a CSS rule, every
// animation must step exactly one 66px strip pitch per frame, every animated
// token must have its prerendered GIF, and nothing may be orphaned.
//
// Usage:
//   node scripts/validate-data.mjs [--public <dir>]
// Exits non-zero (and lists the problems) when the data is inconsistent.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STRIP_PITCH = 66; // SPRITE_SIZE (64) + 2px gap used by the sheet packer

function pngSize(file) {
    const buf = fs.readFileSync(file);
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
        throw new Error(`${file} is not a PNG`);
    }
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readCss(css) {
    const rules = new Map(); // token -> { x, y, anim, steps, sheet }
    // background-position uses bare "0" (no px) for zero offsets, and each
    // token can have two rules (base position + animated override) - merge
    // them, preferring the animated rule's geometry.
    const ruleRe = /\.monumenta-([\w-]+)\s*\{([^}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(css))) {
        const token = m[1];
        const body = m[2];
        const pos = /background-position:\s*(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?/.exec(body);
        if (!pos) continue; // transform-only / reduced-motion overrides
        const anim = /animation:\s*sts-anim-[\w-]+\s+(\d+)ms\s+(?:steps\((\d+),\s*end\)\s+)?infinite/.exec(body);
        const entry = {
            x: Math.abs(Number(pos[1])),
            y: Math.abs(Number(pos[2])),
            anim: Boolean(anim),
            steps: anim && anim[2] ? Number(anim[2]) : null,
            sheet: /background-image:\s*url\(["']?\.\/itemsheet-anim\.png/.test(body) ? 'anim' : 'main',
        };
        const existing = rules.get(token);
        if (!existing) {
            rules.set(token, entry);
        } else if (entry.anim && !existing.anim) {
            rules.set(token, entry); // the animated rule is the authoritative one
        } else if (!existing.anim && !entry.anim) {
            existing.sheet = entry.sheet;
        }
    }

    const keyframes = new Map(); // token -> [{x,y}]
    const kfRe = /@keyframes sts-anim-([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    while ((m = kfRe.exec(css))) {
        const positions = [...m[2].matchAll(/background-position:\s*(-?\d+)px\s+(-?\d+)px/g)].map((p) => ({
            x: Math.abs(Number(p[1])),
            y: Math.abs(Number(p[2])),
        }));
        if (positions.length > 0) keyframes.set(m[1], positions);
    }
    return { rules, keyframes };
}

export function validateData(publicDir) {
    const sheetDir = path.join(publicDir, 'spritesheets');
    const itemsDir = path.join(publicDir, 'items');
    const problems = [];
    const add = (msg) => problems.push(msg);

    const map = JSON.parse(fs.readFileSync(path.join(sheetDir, 'itemsheet-map.json'), 'utf8'));
    const css = fs.readFileSync(path.join(sheetDir, '_itemsheet.css'), 'utf8');
    const sheets = {
        main: pngSize(path.join(sheetDir, 'itemsheet.png')),
        anim: pngSize(path.join(sheetDir, 'itemsheet-anim.png')),
    };
    const { rules, keyframes } = readCss(css);

    const gifs = new Set(
        fs
            .readdirSync(path.join(sheetDir, 'textures'))
            .filter((name) => name.endsWith('.gif'))
            .map((name) => name.slice(0, -4))
    );

    const mapTokens = new Set(Object.values(map));
    if (Object.keys(map).length < 1000) add(`itemsheet-map.json only has ${Object.keys(map).length} keys (expected >1000)`);
    if (rules.size < 1000) add(`_itemsheet.css only has ${rules.size} positioned rules (expected >1000)`);

    // 1. every mapped token must resolve to a rule whose position fits its sheet
    for (const token of mapTokens) {
        const rule = rules.get(token);
        if (!rule) {
            add(`map token "${token}" has no .monumenta-${token} rule in _itemsheet.css`);
            continue;
        }
        const sheet = sheets[rule.sheet];
        if (rule.x + 64 > sheet.width || rule.y + 64 > sheet.height) {
            add(`map token "${token}" sits outside its ${rule.sheet} sheet (${rule.x},${rule.y})`);
        }
    }

    // 2. animated rules: exact stepping, keyframes, GIF
    for (const [token, rule] of rules) {
        const frames = keyframes.get(token);
        if (!rule.anim) {
            if (frames) add(`"${token}" has keyframes but its rule does not animate`);
            continue;
        }
        if (!frames) {
            add(`animated token "${token}" has no @keyframes`);
            continue;
        }
        if (!gifs.has(token)) add(`animated token "${token}" has no textures/${token}.gif`);
        const first = frames[0];
        const last = frames[frames.length - 1];
        const offGrid = frames.filter((p) => (p.x - first.x) % STRIP_PITCH !== 0 || p.y !== first.y);
        if (first.x !== rule.x || first.y !== rule.y) {
            add(`animated token "${token}" starts at ${first.x},${first.y} but its rule points at ${rule.x},${rule.y}`);
        }
        if (offGrid.length > 0) {
            add(`animated token "${token}" has a frame off the ${STRIP_PITCH}px strip grid (x=${offGrid[0].x})`);
        }
        if (rule.steps !== null) {
            const span = last.x - first.x;
            if (span !== rule.steps * STRIP_PITCH) {
                add(
                    `animated token "${token}" uses steps(${rule.steps}) over ${span}px (expected ${rule.steps * STRIP_PITCH}px)`
                );
            }
        }
        const sheet = sheets[rule.sheet];
        if (last.x + 64 > sheet.width || last.y + 64 > sheet.height) {
            add(`animated token "${token}" steps outside its ${rule.sheet} sheet`);
        }
    }

    // 3. orphaned keyframes and GIFs (sign of a partial/stale replacement)
    for (const token of keyframes.keys()) {
        if (!rules.has(token)) add(`@keyframes for "${token}" has no matching rule`);
    }
    for (const token of gifs) {
        if (!rules.get(token)?.anim) add(`textures/${token}.gif exists but the token is not animated in the CSS`);
    }

    // 4. items.json sanity (parse + color format)
    const items = JSON.parse(fs.readFileSync(path.join(itemsDir, 'items.json'), 'utf8'));
    let statColors = 0;
    for (const [key, item] of Object.entries(items)) {
        for (const [stat, color] of Object.entries(item.statColors || {})) {
            if (!/^#[0-9A-F]{6}$/.test(color)) {
                add(`item "${key}" stat "${stat}" has an invalid color "${color}"`);
            } else {
                statColors++;
            }
        }
    }

    return {
        problems,
        stats: {
            mapKeys: Object.keys(map).length,
            mapTokens: mapTokens.size,
            rules: rules.size,
            animated: [...rules.values()].filter((r) => r.anim).length,
            gifs: gifs.size,
            items: Object.keys(items).length,
            statColors,
        },
    };
}

function main() {
    const argIdx = process.argv.indexOf('--public');
    const publicDir =
        argIdx !== -1 ? path.resolve(process.argv[argIdx + 1]) : path.join(__dirname, '..', 'public');
    const { problems, stats } = validateData(publicDir);
    console.log(
        `[check:data] ${stats.mapKeys} map keys (${stats.mapTokens} tokens), ${stats.rules} css rules, ` +
            `${stats.animated} animated (${stats.gifs} gifs), ${stats.items} items (${stats.statColors} stat colors)`
    );
    if (problems.length > 0) {
        console.error(`[check:data] FAILED - ${problems.length} problem(s):`);
        for (const problem of problems.slice(0, 30)) console.error(`  - ${problem}`);
        if (problems.length > 30) console.error(`  ... and ${problems.length - 30} more`);
        process.exit(1);
    }
    console.log('[check:data] OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
