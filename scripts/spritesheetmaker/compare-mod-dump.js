#!/usr/bin/env node
// Compares the Spare the Sympathy dump against the Monumenta resource pack in
// the repo (MonumentaRP_v6.1.0): for every animated item, the frame count and
// per-frame dwell times (ticks) must match the pack's texture mcmeta, using
// the vanilla animation rules re-implemented independently.
//
// Usage:
//   node compare-mod-dump.js [dumpDir] [packDir]
// Defaults: dumpDir = PrismLauncher config/sparethesympathy, packDir = ./MonumentaRP_v6.1.0

const fs = require('fs');
const path = require('path');

const DEFAULT_DUMP = path.join(
    process.env.APPDATA || '',
    'PrismLauncher', 'instances', 'deepaaaaar monumenta', 'minecraft', 'config', 'sparethesympathy');
const DEFAULT_PACK = path.join(__dirname, 'MonumentaRP_v6.1.0');

const dumpDir = process.argv[2] || DEFAULT_DUMP;
const packDir = process.argv[3] || DEFAULT_PACK;

// ---------------------------------------------------------------------------
// Vanilla animation rules (re-implemented from SpriteContents / SpriteLoader)
// ---------------------------------------------------------------------------

function pngSize(file) {
    const fd = fs.openSync(file, 'r');
    try {
        const header = Buffer.alloc(33);
        fs.readSync(fd, header, 0, 33, 0);
        if (header.readUInt32BE(0) !== 0x89504e47) {
            throw new Error('not a png');
        }
        return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
    } finally {
        fs.closeSync(fd);
    }
}

function readMcmeta(file) {
    const metaFile = file + '.mcmeta';
    if (!fs.existsSync(metaFile)) {
        return null;
    }
    let text;
    try {
        text = fs.readFileSync(metaFile, 'utf8');
    } catch (err) {
        return null;
    }
    try {
        const root = JSON.parse(text);
        return root && root.animation ? root.animation : null;
    } catch (err) {
        // The game parses mcmeta leniently (Gson lenient reader), so some
        // malformed files still load. Extract the first balanced JSON object.
        const start = text.indexOf('{');
        if (start < 0) {
            return null;
        }
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }
            if (ch === '"') {
                inString = true;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    try {
                        const root = JSON.parse(text.slice(start, i + 1));
                        return root && root.animation ? root.animation : null;
                    } catch (err2) {
                        return null;
                    }
                }
            }
        }
        return null;
    }
}

function expectedFrames(width, height, anim) {
    if (!anim) {
        return [{ cell: 0, dwell: 1 }];
    }
    const defaultTime = anim.frametime !== undefined ? anim.frametime : 1;
    let frameW;
    let frameH;
    if (anim.width !== undefined && anim.height !== undefined) {
        frameW = anim.width;
        frameH = anim.height;
    } else if (anim.width !== undefined) {
        frameW = anim.width;
        frameH = height;
    } else if (anim.height !== undefined) {
        frameW = width;
        frameH = anim.height;
    } else {
        const size = Math.min(width, height);
        frameW = size;
        frameH = size;
    }
    const rowSize = Math.floor(width / frameW);
    const totalCells = rowSize * Math.floor(height / frameH);

    let cells = [];
    if (Array.isArray(anim.frames)) {
        for (const frame of anim.frames) {
            if (typeof frame === 'number') {
                cells.push({ cell: frame, dwell: defaultTime });
            } else {
                cells.push({ cell: frame.index, dwell: frame.time !== undefined ? frame.time : defaultTime });
            }
        }
    }
    if (cells.length === 0) {
        for (let cell = 0; cell < totalCells; cell++) {
            cells.push({ cell, dwell: defaultTime });
        }
    }
    cells = cells.filter(c => c.cell >= 0 && c.cell < totalCells && c.dwell > 0);
    if (cells.length <= 1) {
        return [{ cell: 0, dwell: 1 }];
    }
    return cells;
}

// ---------------------------------------------------------------------------
// Main comparison
// ---------------------------------------------------------------------------

function main() {
    const manifestFile = path.join(dumpDir, 'itemsheet-manifest.json');
    if (!fs.existsSync(manifestFile)) {
        console.error(`Dump manifest not found: ${manifestFile}`);
        console.error(`Pass the dump dir as the first argument.`);
        process.exit(2);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const animated = manifest.entries.filter(e => e.frameCount > 1);

    let checked = 0;
    let unverifiable = 0;
    const problems = [];

    for (const entry of animated) {
        if (!entry.texture) {
            unverifiable++;
            continue;
        }
        const rel = entry.texture.startsWith('minecraft/') ? entry.texture.slice('minecraft/'.length) : entry.texture;
        const textureFile = path.join(packDir, 'assets', 'minecraft', rel + '.png');
        if (!fs.existsSync(textureFile)) {
            unverifiable++;
            continue;
        }
        const { width, height } = pngSize(textureFile);
        const frames = expectedFrames(width, height, readMcmeta(textureFile));
        checked++;
        const expectedDwells = frames.map(f => f.dwell);
        const matches = (count, dwells) =>
            entry.frameCount === count && JSON.stringify(entry.dwells) === JSON.stringify(dwells);
        let ok = matches(frames.length, expectedDwells);
        let scaled = false;
        if (!ok) {
            // CIT Resewn doubles the texture (and any mcmeta frame-size
            // overrides) in the atlas, which changes the in-game frame count;
            // accept the scaled variants too.
            const anim = readMcmeta(textureFile);
            const variants = [
                [width * 2, height * 2, anim],
                [width * 2, height, anim],
            ];
            if (anim && (anim.width !== undefined || anim.height !== undefined)) {
                const scaledAnim = {
                    ...anim,
                    width: anim.width !== undefined ? anim.width * 2 : undefined,
                    height: anim.height !== undefined ? anim.height * 2 : undefined,
                };
                variants.push([width * 2, height * 2, scaledAnim]);
                variants.push([width * 2, height, scaledAnim]);
            }
            for (const [w2, h2, a2] of variants) {
                const frames2x = expectedFrames(w2, h2, a2);
                const dwells2x = frames2x.map(f => f.dwell);
                if (matches(frames2x.length, dwells2x)) {
                    ok = true;
                    scaled = true;
                    break;
                }
            }
        }
        if (!ok) {
            problems.push({
                key: entry.key,
                texture: entry.texture,
                expected: { frameCount: frames.length, dwells: expectedDwells },
                actual: { frameCount: entry.frameCount, dwells: entry.dwells },
            });
        }
    }

    console.log(`Dump: ${dumpDir}`);
    console.log(`Animated entries: ${animated.length}   Verified: ${checked}   Unverifiable (no pack texture): ${unverifiable}`);
    console.log('');

    if (problems.length) {
        console.log(`MISMATCHES (${problems.length}):`);
        for (const p of problems.slice(0, 30)) {
            console.log(`  - ${p.key} (${p.texture.replace('minecraft:optifine/cit/', '')})`);
            console.log(`      expected: frameCount=${p.expected.frameCount} dwells=[${p.expected.dwells.join(',')}]`);
            console.log(`      actual:   frameCount=${p.actual.frameCount} dwells=[${p.actual.dwells.join(',')}]`);
        }
        if (problems.length > 30) {
            console.log(`  ... and ${problems.length - 30} more`);
        }
    } else {
        console.log('All animated entries match the pack frame counts and dwell times.');
    }

    console.log('');
    console.log(problems.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${problems.length} mismatches)`);
    process.exit(problems.length === 0 ? 0 : 1);
}

main();
