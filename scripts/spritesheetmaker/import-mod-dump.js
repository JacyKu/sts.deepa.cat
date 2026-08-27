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
// dumpDir defaults to the PrismLauncher instance config folder.
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
    'deepaaaaar monumenta',
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

async function main() {
    const dumpDir = process.argv[2] || DEFAULT_DUMP_DIR;
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

    if (!manifest.entries || !Array.isArray(manifest.entries)) {
        console.error('[spritesheet-import] Invalid itemsheet-manifest.json: missing entries.');
        process.exit(1);
    }
    // Animated entries live on a dedicated spritesheet (manifest.animSheet).
    const hasAnimSheet = Boolean(manifest.animSheet);

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

    await fs.copyFile(stsSheetPath, path.join(OUTPUT_DIR, `${SHEET_NAME}.png`));
    if (hasAnimSheet) {
        await fs.copyFile(stsAnimSheetPath, path.join(OUTPUT_DIR, `${SHEET_NAME}-anim.png`));
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
