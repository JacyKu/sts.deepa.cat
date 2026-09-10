// Import the Spare the Sympathy mod dump into the site's spritesheet contract:
// itemsheet.png, itemsheet-anim.png, itemsheet-map.json, and _itemsheet.css.
// The dump is produced by the mod in the game's config folder:
//   <instance>/config/sparethesympathy/itemsheet-manifest.json
//   <instance>/config/sparethesympathy/itemsheet.png
//   <instance>/config/sparethesympathy/itemsheet-anim.png
//
// The manifest carries the animation frame dwells (in 1/20s ticks) read from
// the Monumenta resource pack's mcmeta files, so the generated CSS animations
// reproduce the pack's exact frame timings.
//
// Run from apps/sts:
//   node scripts/spritesheetmaker/import-mod-dump.js [dumpDir]
// dumpDir is, in order of precedence: the CLI argument, the STS_DUMP_DIR
// environment variable, or the devumenta PrismLauncher instance (the only
// instance used for dumps - the old "deepaaaaar monumenta" one is ignored).
// An import whose dump is older than the current spritesheets is refused
// unless --force is passed (an explicit dumpDir only warns).
//
// Everything else (tiles, charm fallbacks, stylesheet loading) keeps working because
// the generated artifacts match the contract the rest of the site consumes.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'public', 'spritesheets');
const ITEM_DATA_PATH = path.join(__dirname, '..', '..', 'public', 'items', 'items.json');
const DEFAULT_DUMP_DIR = path.join(
    process.env.APPDATA || '',
    'PrismLauncher',
    'instances',
    'devumenta',
    'minecraft',
    'config',
    'sparethesympathy'
);
const SHEET_NAME = 'itemsheet';
const CLASS_PREFIX = 'monumenta';
const SPRITE_SIZE = 64;
// The site's sprite tiles are zoomed by Items.module.css (.imageIcon > .monumenta-items
// scale(1.15)); scaled-up cells keep the same zoom so their artwork matches the
// other tiles' rendered size.
const ICON_ZOOM = 1.15;

function normalizeBaseToken(value) {
    return String(value || '')
        .replaceAll('-', '_')
        .replaceAll(' ', '_')
        .replaceAll("'", '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function tokenForName(name) {
    const baseToken = normalizeBaseToken(name)
        // Keep only CSS-safe characters: dots, parentheses, commas etc. in item
        // names (C.A.L.D.E.R., "(u)", "(bow)") would otherwise produce selectors
        // like .monumenta-b.o.n.k_... that browsers discard as invalid.
        .replace(/[^a-z0-9_]/g, '_');
    const hash = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 8);
    return `${baseToken}_${hash}`;
}

function isSpecialEntry(entry) {
    const animated = entry.frameCount >= 2;
    const oversize = entry.width !== SPRITE_SIZE || entry.height !== SPRITE_SIZE;
    return animated || oversize;
}

function positionPair(x, y) {
    return `${-x}px ${-y}px`;
}

function percentage(cumulativeTicks, totalTicks) {
    return String(Math.round((cumulativeTicks * 10000) / totalTicks) / 100);
}

function uniformKeyframes(name, x, y, frameCount, pitch) {
    const from = positionPair(x, y);
    const to = positionPair(x + frameCount * pitch, y);
    return (
        `@keyframes ${name} {\n` +
        `\tfrom { background-position: ${from} }\n` +
        `\tto { background-position: ${to} }\n` +
        `}`
    );
}

function variableKeyframes(name, x, y, pitch, frames, totalTicks) {
    // The timing function on a keyframe governs the segment from it to the NEXT
    // keyframe (css-animations-1 §4.3), so every stop but the final 100% one
    // carries steps(1, end): it holds the stop's position for the segment that
    // follows, jumping to the next frame at the stop. The 100% stop repeats the
    // last position without a timing function (any there would be ignored).
    let body = `\t0% { background-position: ${positionPair(x, y)}; animation-timing-function: steps(1, end); }\n`;
    let cumulative = 0;
    let previous = -1;
    for (let index = 0; index < frames.length - 1; index++) {
        cumulative += frames[index];
        const stop = percentage(cumulative, totalTicks);
        if (stop === previous) {
            continue;
        }
        previous = stop;
        body += `\t${stop}% { background-position: ${positionPair(x + (index + 1) * pitch, y)}; animation-timing-function: steps(1, end); }\n`;
    }
    body += `\t100% { background-position: ${positionPair(x + (frames.length - 1) * pitch, y)} }\n`;
    return `@keyframes ${name} {\n${body}}`;
}

function reducedMotionRule(token) {
    return (
        `@media (prefers-reduced-motion: reduce) {\n` +
        `\t.${CLASS_PREFIX}-${token} {\n` +
        `\t\tanimation: none;\n` +
        `\t}\n` +
        `}`
    );
}

// The mod fits each icon's artwork inside its 64px cell; cells whose painted
// content is smaller than the cell (content that was scaled down to fit, or
// awkward integer-fit sizes) render smaller than full cells on the site.
// Measure the painted content of every frame's own cell (animated strips lay
// frames side by side, so a strip-wide scan would span many cells), then emit
// a per-token scale so the content fills the same rendered size as full cells.
// !important beats the tile zoom rule in Items.module.css.
function measureContentMax(sheet, entry) {
    const framesPerRow = entry.cols > 1 ? entry.cols : entry.frameCount;
    let maxContent = 0;
    for (let frame = 0; frame < entry.frameCount; frame++) {
        const fx = entry.x + (frame % framesPerRow) * entry.pitch;
        const fy = entry.y + Math.floor(frame / framesPerRow) * entry.rowPitch;
        const x1 = Math.min(sheet.width, fx + entry.width);
        const y1 = Math.min(sheet.height, fy + entry.height);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -1;
        let maxY = -1;
        for (let y = fy; y < y1; y++) {
            for (let x = fx; x < x1; x++) {
                if (sheet.data[(y * sheet.width + x) * 4 + 3] > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX >= minX) {
            maxContent = Math.max(maxContent, Math.max(maxX - minX + 1, maxY - minY + 1));
        }
    }
    return maxContent;
}

// ---------------------------------------------------------------------------
// Output validation. A wrong keyframe formula or a manifest/sheet mismatch
// makes animated sprites drift sideways ("sliding") instead of stepping
// through their frames - a silent visual bug that is easy to miss until
// someone notices. Before anything is written, verify:
//   1. every animated strip fits in its sheet and sits on the expected pitch
//      (2px transparent gap columns between frames - checks x/pitch against
//      the actual packed PNG),
//   2. the emitted CSS animation walks exactly the strip's frame positions
//      (uniform strips: span === frameCount * pitch; variable strips: every
//      stop on the x + k*pitch grid),
//   3. multi-row animated strips (cols > 1) are rejected: the CSS generator
//      only walks horizontally, so wrapped strips would slide across rows.
// Returns a list of human-readable problems; empty means everything is sane.
function validateAnimations(manifest, sheets, stylesFile, hasAnimSheet) {
    const errors = [];
    const firstByToken = new Map();
    for (const entry of manifest.entries) {
        const token = tokenForName(entry.key);
        if (!firstByToken.has(token)) firstByToken.set(token, entry);
    }

    for (const [token, entry] of firstByToken) {
        const frameCount = Number(entry.frameCount) || 1;
        if (frameCount < 2) continue;
        const pitch = Number.isInteger(entry.pitch) && entry.pitch > 0 ? entry.pitch : SPRITE_SIZE + 2;
        const sheet = sheets[entry.sheet === 'anim' ? 'anim' : 'main'];
        if (!sheet) continue;
        const label = `${entry.key} (${token})`;

        if ((entry.cols || 1) > 1) {
            errors.push(
                `${label}: multi-row animated strip (cols=${entry.cols}) is not supported by the CSS generator`
            );
            continue;
        }

        // 1. strip bounds + gap alignment against the packed sheet
        const stripEnd = entry.x + (frameCount - 1) * pitch + entry.width;
        if (entry.x < 0 || entry.y < 0 || stripEnd > sheet.width || entry.y + entry.height > sheet.height) {
            errors.push(`${label}: strip exceeds its sheet bounds`);
            continue;
        }
        const gap = pitch - entry.width;
        if (gap > 0) {
            for (let frame = 0; frame < frameCount - 1; frame++) {
                const gapX = entry.x + frame * pitch + entry.width;
                let opaque = 0;
                for (let y = entry.y; y < entry.y + entry.height; y++) {
                    for (let x = gapX; x < gapX + gap; x++) {
                        if (sheet.data[(y * sheet.width + x) * 4 + 3] > 0) opaque++;
                    }
                }
                if (opaque > 0) {
                    errors.push(
                        `${label}: frame ${frame} does not end on the expected ${pitch}px pitch (${opaque} opaque pixels in the gap)`
                    );
                    break;
                }
            }
        }
        // first frame cell must actually contain artwork
        let content = 0;
        for (let y = entry.y; y < entry.y + entry.height && content === 0; y++) {
            for (let x = entry.x; x < entry.x + entry.width; x++) {
                if (sheet.data[(y * sheet.width + x) * 4 + 3] > 0) {
                    content++;
                    break;
                }
            }
        }
        if (content === 0) {
            errors.push(`${label}: first frame cell is empty`);
        }

        // 2. emitted CSS animation geometry
        const name = `sts-anim-${token}`;
        const keyframes = new RegExp(
            `@keyframes ${name}\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`,
            'g'
        ).exec(stylesFile);
        if (!keyframes) {
            errors.push(`${label}: no @keyframes emitted`);
            continue;
        }
        const positions = [...keyframes[1].matchAll(/background-position:\s*(-?\d+)px\s+(-?\d+)px/g)].map((m) => ({
            x: Math.abs(Number(m[1])),
            y: Math.abs(Number(m[2])),
        }));
        if (positions.length === 0) {
            errors.push(`${label}: keyframes contain no positions`);
            continue;
        }
        const expectedX = new Set();
        for (let frame = 0; frame < frameCount; frame++) expectedX.add(entry.x + frame * pitch);
        // Uniform strips animate with `steps(N, end)` from the strip start to
        // x + N*pitch (the end target is intentionally one pitch past the last
        // frame and is never displayed). Variable strips list every frame stop
        // explicitly, so every position must sit on the frame grid.
        const ruleMatch = new RegExp(
            `\\.${CLASS_PREFIX}-${token}\\s*\\{[^}]*animation:\\s*${name}\\s+(\\d+)ms\\s+steps\\((\\d+),\\s*end\\)`
        ).exec(stylesFile);
        if (ruleMatch) {
            const steps = Number(ruleMatch[2]);
            const first = positions[0];
            const last = positions[positions.length - 1];
            if (steps !== frameCount || last.x - first.x !== frameCount * pitch) {
                errors.push(
                    `${label}: uniform animation is steps(${steps}) over ${last.x - first.x}px, expected steps(${frameCount}) over ${frameCount * pitch}px`
                );
            } else if (first.x !== entry.x || first.y !== entry.y) {
                errors.push(`${label}: uniform animation starts at x=${first.x} y=${first.y}, expected x=${entry.x} y=${entry.y}`);
            }
        } else {
            const offGrid = positions.filter((p) => !expectedX.has(p.x) || p.y !== entry.y);
            if (offGrid.length > 0) {
                errors.push(
                    `${label}: keyframes step to x=${offGrid[0].x} which is not a frame position (expected x + k*${pitch})`
                );
            } else if (
                positions[0].x !== entry.x ||
                positions[positions.length - 1].x !== entry.x + (frameCount - 1) * pitch
            ) {
                errors.push(`${label}: variable animation does not start/end on the strip's first/last frame`);
            }
        }
        if (
            hasAnimSheet &&
            entry.sheet === 'anim' &&
            !new RegExp(`\\.${CLASS_PREFIX}-${token}\\s*\\{[^}]*background-image`).test(stylesFile)
        ) {
            errors.push(`${label}: animated rule does not point at the animated sheet`);
        }
    }
    return errors;
}

// Reject malformed manifests before doing any work: a dump missing frame
// metadata would otherwise silently render animated items as static (or
// worse), which is exactly the kind of "updated dump caused weirdness"
// surprise this pipeline is supposed to prevent.
function validateManifest(manifest, hasAnimSheet) {
    const errors = [];
    for (const entry of manifest.entries) {
        const label = entry && typeof entry.key === 'string' ? entry.key : JSON.stringify(entry).slice(0, 60);
        if (!entry || typeof entry.key !== 'string') {
            errors.push('entry without a string key');
            continue;
        }
        for (const field of ['x', 'y']) {
            if (!Number.isFinite(entry[field])) errors.push(`${label}: missing/invalid ${field}`);
        }
        if (!Number.isInteger(entry.frameCount) || entry.frameCount < 1) {
            errors.push(`${label}: invalid frameCount ${entry.frameCount}`);
            continue;
        }
        if (entry.frameCount >= 2) {
            if (!Array.isArray(entry.dwells) || entry.dwells.length !== entry.frameCount) {
                const found = Array.isArray(entry.dwells) ? entry.dwells.length : 'missing';
                errors.push(`${label}: ${entry.frameCount} frames but dwells ${found}`);
            }
            if (!Number.isInteger(entry.pitch) || entry.pitch <= 0) {
                errors.push(`${label}: animated entry has no valid pitch`);
            }
            if (hasAnimSheet && entry.sheet !== 'main' && entry.sheet !== 'anim') {
                errors.push(`${label}: invalid sheet "${entry.sheet}"`);
            }
        }
        for (const field of ['width', 'height']) {
            if (entry[field] !== undefined && (!Number.isInteger(entry[field]) || entry[field] <= 0)) {
                errors.push(`${label}: invalid ${field} ${entry[field]}`);
            }
        }
    }
    return errors;
}

async function main() {
    const flags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
    const explicitDir = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
    const force = flags.includes('--force');
    const explicit = Boolean(explicitDir || process.env.STS_DUMP_DIR);
    const dumpDir = explicitDir || process.env.STS_DUMP_DIR || DEFAULT_DUMP_DIR;
    console.log(`[spritesheet-import] dump source: ${dumpDir}`);
    const stsSheetPath = path.join(dumpDir, 'itemsheet.png');
    const stsAnimSheetPath = path.join(dumpDir, 'itemsheet-anim.png');
    const stsJsonPath = path.join(dumpDir, 'itemsheet-manifest.json');

    let manifest;
    try {
        manifest = JSON.parse(await fs.readFile(stsJsonPath, 'utf8'));
    } catch (error) {
        console.error(`[spritesheet-import] Unable to read ${stsJsonPath}: ${error.message}`);
        console.error('[spritesheet-import] Dump the mod in-game first (config/sparethesympathy).');
        process.exit(1);
    }

    // Guard against importing an old dump over fresher data by accident.
    // An explicitly chosen dump dir only warns; the default (devumenta) dump
    // refuses unless --force is passed.
    try {
        const manifestStat = await fs.stat(stsJsonPath);
        const cssStat = await fs.stat(path.join(OUTPUT_DIR, `_${SHEET_NAME}.css`));
        if (manifestStat.mtimeMs < cssStat.mtimeMs && !force) {
            const message =
                `this dump (${manifestStat.mtime.toISOString()}) is older than the current spritesheets ` +
                `(${cssStat.mtime.toISOString()}) - dump in-game first if you meant to refresh them`;
            if (explicit) {
                console.warn(`[spritesheet-import] WARNING: ${message}`);
            } else {
                console.error(`[spritesheet-import] ${message}.`);
                console.error('[spritesheet-import] Nothing written. Pass --force to import this dump anyway.');
                process.exit(1);
            }
        }
    } catch (error) {
        // no previous generated spritesheets - nothing to compare against
    }

    if (!manifest.entries || !Array.isArray(manifest.entries)) {
        console.error('[spritesheet-import] Invalid itemsheet-manifest.json: missing entries.');
        process.exit(1);
    }
    // Animated entries live on a dedicated spritesheet (manifest.animSheet).
    const hasAnimSheet = Boolean(manifest.animSheet);

    const manifestErrors = validateManifest(manifest, hasAnimSheet);
    if (manifestErrors.length > 0) {
        console.error(`[spritesheet-import] Invalid manifest (${manifestErrors.length} problem(s)) - nothing written:`);
        for (const error of manifestErrors.slice(0, 25)) console.error(`  - ${error}`);
        if (manifestErrors.length > 25) console.error(`  ... and ${manifestErrors.length - 25} more`);
        process.exit(1);
    }

    // One token per manifest key (each masterwork rank is rendered and has its
    // own cell); base and ranked entries that share a cell get separate rules
    // pointing at the same position. The first entry for a token wins, so a
    // base name appearing next to several ranks keeps its first cell.
    // Special entries (animated strips and oversize cells) are collected the
    // same way so their width/height/animation rules override the base ones.
    const rulesByToken = new Map();
    const specialByToken = new Map();
    const nameToToken = {};
    for (const entry of manifest.entries) {
        const token = tokenForName(entry.key);
        if (!rulesByToken.has(token)) {
            rulesByToken.set(token, { x: entry.x, y: entry.y, sheet: entry.sheet === 'anim' ? 'anim' : 'main' });
            if (isSpecialEntry(entry)) {
                specialByToken.set(token, {
                    x: entry.x,
                    y: entry.y,
                    w: entry.width,
                    h: entry.height,
                    pitch: entry.pitch,
                    frames: entry.dwells,
                });
            }
        }
        if (!nameToToken[entry.key]) {
            nameToToken[entry.key] = token;
        }
    }

    // Same key set as the old pipeline: display name first, then the raw items.json
    // key, then any extra manifest keys (items not present on the site yet).
    const itemMap = {};
    let itemData = {};
    try {
        itemData = JSON.parse(await fs.readFile(ITEM_DATA_PATH, 'utf8'));
    } catch (error) {
        console.warn(`[spritesheet-import] Unable to load item data for mapping: ${error.message}`);
    }

    // Rank variants ("God Tamer-1") alias the base display name ("God Tamer") to
    // the lowest available rank's token, since the mod dump has no base-only entry.
    const rankToken = {};
    for (const itemKey of Object.keys(itemData)) {
        const rankMatch = /-(\d+)\s*$/.exec(itemKey);
        if (!rankMatch || !nameToToken[itemKey]) {
            continue;
        }
        const stripped = itemKey.slice(0, rankMatch.index);
        const rank = Number(rankMatch[1]);
        const previous = rankToken[stripped];
        if (!previous || rank < previous.rank) {
            rankToken[stripped] = { rank, token: nameToToken[itemKey] };
        }
    }

    for (const itemKey of Object.keys(itemData)) {
        const item = itemData[itemKey] || {};
        const displayName = item.name || itemKey;
        if (!itemMap[displayName] && nameToToken[displayName]) {
            itemMap[displayName] = nameToToken[displayName];
        }
        if (!itemMap[itemKey] && nameToToken[itemKey]) {
            itemMap[itemKey] = nameToToken[itemKey];
        }
        if (!itemMap[displayName] && rankToken[displayName]) {
            itemMap[displayName] = rankToken[displayName].token;
        }
        if (!itemMap[itemKey] && rankToken[itemKey]) {
            itemMap[itemKey] = rankToken[itemKey].token;
        }
    }
    for (const entry of manifest.entries) {
        if (!itemMap[entry.key]) {
            itemMap[entry.key] = nameToToken[entry.key];
        }
    }

    let stylesFile =
        `.${CLASS_PREFIX}-items {\n` +
        `\tbackground-image: url("./${SHEET_NAME}.png");\n` +
        '\tbackground-repeat: no-repeat;\n' +
        '\tdisplay: inline-block;\n' +
        '\tvertical-align: middle;\n' +
        `\twidth: ${SPRITE_SIZE}px;\n` +
        `\theight: ${SPRITE_SIZE}px;\n` +
        '}\n\n';
    for (const [token, cell] of rulesByToken) {
        const { x, y, sheet } = cell;
        stylesFile += `.${CLASS_PREFIX}-${token} {\n`;
        stylesFile += `\tbackground-position: ${x !== 0 ? `-${x}px` : '0'} ${y !== 0 ? `-${y}px` : '0'};\n`;
        // Cells on the animated sheet must sample itemsheet-anim.png even when
        // the capture produced a single frame (the base .monumenta-items rule
        // points at the main sheet).
        if (sheet === 'anim' && hasAnimSheet) {
            stylesFile += `\tbackground-image: url("./${SHEET_NAME}-anim.png");\n`;
        }
        stylesFile += '}\n\n';
    }

    // Special cells: the strip-start position, then explicit width/height for
    // oversize cells and a CSS animation for animated strips.
    const TICK_MS = 50;
    for (const [token, special] of specialByToken) {
        const pitch = Number.isInteger(special.pitch) && special.pitch > 0 ? special.pitch : SPRITE_SIZE + 2;
        const position = positionPair(special.x, special.y);

        const animated = Array.isArray(special.frames) && special.frames.length >= 2;
        const totalTicks = animated ? special.frames.reduce((sum, dwell) => sum + dwell, 0) : 0;

        let rule = `.${CLASS_PREFIX}-${token} {\n`;
        rule += `\tbackground-position: ${position};\n`;
        if (animated && hasAnimSheet) {
            rule += `\tbackground-image: url("./${SHEET_NAME}-anim.png");\n`;
        }
        if (Number.isInteger(special.w) && special.w > 0) {
            rule += `\twidth: ${special.w}px;\n`;
        }
        if (Number.isInteger(special.h) && special.h > 0) {
            rule += `\theight: ${special.h}px;\n`;
        }
        if (animated && totalTicks > 0) {
            const name = `sts-anim-${token}`;
            const totalMs = totalTicks * TICK_MS;
            const uniform = special.frames.every((dwell) => dwell === special.frames[0]);
            if (uniform) {
                rule += `\tanimation: ${name} ${totalMs}ms steps(${special.frames.length}, end) infinite;\n`;
                stylesFile += rule + '}\n\n';
                stylesFile += uniformKeyframes(name, special.x, special.y, special.frames.length, pitch) + '\n\n';
            } else {
                rule += `\tanimation: ${name} ${totalMs}ms infinite;\n`;
                stylesFile += rule + '}\n\n';
                stylesFile += variableKeyframes(name, special.x, special.y, pitch, special.frames, totalTicks) + '\n\n';
            }
            stylesFile += reducedMotionRule(token) + '\n\n';
        } else {
            stylesFile += rule + '}\n\n';
        }
    }

    // Decode both sheets and measure the painted content of every cell/strip,
    // then scale up the cells whose content is smaller than the cell so the
    // artwork renders at the same size as full cells on the site.
    const sheets = {};
    for (const name of ['main', 'anim']) {
        const file = path.join(dumpDir, name === 'main' ? `${SHEET_NAME}.png` : `${SHEET_NAME}-anim.png`);
        const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
        sheets[name] = { width: info.width, height: info.height, data };
    }

    // Refuse to write a broken spritesheet revision: if any animated strip's
    // geometry or emitted keyframes are off (the "sliding sprites" bug), fail
    // loudly and leave the previous, working files in place.
    const validationErrors = validateAnimations(manifest, sheets, stylesFile, hasAnimSheet);
    if (validationErrors.length > 0) {
        console.error(`[spritesheet-import] Validation failed (${validationErrors.length} problem(s)) - nothing written:`);
        for (const error of validationErrors.slice(0, 25)) console.error(`  - ${error}`);
        if (validationErrors.length > 25) {
            console.error(`  ... and ${validationErrors.length - 25} more`);
        }
        process.exit(1);
    }

    await fs.copyFile(stsSheetPath, path.join(OUTPUT_DIR, `${SHEET_NAME}.png`));
    if (hasAnimSheet) {
        await fs.copyFile(stsAnimSheetPath, path.join(OUTPUT_DIR, `${SHEET_NAME}-anim.png`));
    }
    const scaledByToken = new Map();
    const seenTokens = new Set();
    for (const entry of manifest.entries) {
        const token = tokenForName(entry.key);
        if (seenTokens.has(token)) {
            continue;
        }
        seenTokens.add(token);
        const sheet = sheets[entry.sheet];
        const contentMax = sheet ? measureContentMax(sheet, entry) : 0;
        if (contentMax > 0 && contentMax < SPRITE_SIZE) {
            scaledByToken.set(token, contentMax);
        }
    }
    for (const [token, contentMax] of scaledByToken) {
        const scale = (ICON_ZOOM * SPRITE_SIZE) / contentMax;
        if (scale > ICON_ZOOM) {
            stylesFile += `.${CLASS_PREFIX}-${token} {\n\ttransform: scale(${scale.toFixed(3)}) !important;\n}\n\n`;
        }
    }

    await fs.writeFile(path.join(OUTPUT_DIR, `_${SHEET_NAME}.css`), stylesFile);

    // Warn when tokens disappear: custom items store a chosen texture token,
    // so a dropped token means those items fall back to name/base textures
    // (the site handles that gracefully, but it's worth surfacing here).
    try {
        const previousMap = JSON.parse(await fs.readFile(path.join(OUTPUT_DIR, `${SHEET_NAME}-map.json`), 'utf8'));
        const newTokens = new Set(Object.values(itemMap));
        const lost = [...new Set(Object.values(previousMap))].filter((token) => !newTokens.has(token));
        if (lost.length > 0) {
            console.warn(
                `[spritesheet-import] WARNING: ${lost.length} sprite token(s) disappeared from the map ` +
                    `(custom items using them will fall back): ${lost.slice(0, 8).join(', ')}${lost.length > 8 ? ', ...' : ''}`
            );
        }
    } catch (error) {
        // no previous map - nothing to compare against
    }

    await fs.writeFile(path.join(OUTPUT_DIR, `${SHEET_NAME}-map.json`), JSON.stringify(itemMap, null, 2));

    // Prerender every animated item into its own GIF (textures/<token>.gif)
    // so the site and the Discord bot serve prebuilt files instead of
    // encoding on demand. Deterministic output, so the files are stable
    // between imports of unchanged textures.
    const gifCount = await writeAnimatedGifs(manifest, sheets);

    console.log(
        `[spritesheet-import] ${manifest.entries.length} manifest entries, ${rulesByToken.size} unique tokens (${specialByToken.size} special), ${SPRITE_SIZE}px sprites${hasAnimSheet ? ', separate animated sheet' : ''}`
    );
    console.log(
        `[spritesheet-import] ${Object.keys(itemMap).length} item map keys (${Object.keys(itemData).length} from items.json)`
    );
    console.log(`[spritesheet-import] Scaled up ${scaledByToken.size} under-filled cells`);
    console.log(`[spritesheet-import] Prerendered ${gifCount} animated GIFs into textures/`);
    console.log(
        `[spritesheet-import] Wrote itemsheet.png, _itemsheet.css, itemsheet-map.json${hasAnimSheet ? ', itemsheet-anim.png' : ''}`
    );
}

// Renders each animated strip (2+ frames) into a standalone GIF at
// textures/<token>.gif, using the same encoding the texture endpoint uses
// (2x nearest upscale, per-frame palettes, disposal-to-transparent).
async function writeAnimatedGifs(manifest, sheets) {
    const { encodeFrames } = require('./gifEncode');
    const textureDir = path.join(OUTPUT_DIR, 'textures');
    await fs.mkdir(textureDir, { recursive: true });

    // Clear stale GIFs (items that stopped being animated).
    for (const name of await fs.readdir(textureDir)) {
        if (name.endsWith('.gif')) {
            await fs.unlink(path.join(textureDir, name));
        }
    }

    const SCALE = 2;
    const cellSize = SPRITE_SIZE * SCALE;
    let count = 0;
    const seen = new Set();
    for (const entry of manifest.entries) {
        const token = tokenForName(entry.key);
        if (seen.has(token)) continue;
        if (entry.sheet !== 'anim') continue;
        const frameCount = Number(entry.frameCount) || 1;
        if (frameCount < 2) continue;
        seen.add(token);

        const sheet = sheets.anim;
        const pitch = Number.isInteger(entry.pitch) && entry.pitch > 0 ? entry.pitch : SPRITE_SIZE + 2;
        const frames = [];
        const delays = [];
        for (let i = 0; i < frameCount; i++) {
            const x = entry.x + i * pitch;
            const raw = await sharp(sheet.data, {
                raw: { width: sheet.width, height: sheet.height, channels: 4 },
                limitInputPixels: false,
            })
                .extract({ left: x, top: entry.y, width: SPRITE_SIZE, height: SPRITE_SIZE })
                .resize(cellSize, cellSize, { kernel: sharp.kernel.nearest })
                .raw()
                .toBuffer();
            frames.push(raw);
            // Dwells are in 1/20s ticks; centiseconds = ticks * 5.
            const dwell = Number(entry.dwells && entry.dwells[i]) || 1;
            delays.push(Math.max(1, dwell * 5));
        }
        const gif = encodeFrames(frames, cellSize, cellSize, delays);
        await fs.writeFile(path.join(textureDir, `${token}.gif`), gif);
        count++;
    }
    return count;
}

main().catch((error) => {
    console.error('[spritesheet-import] Failed:', error);
    process.exit(1);
});
