import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { GifWriter } from 'omggif';
import { getItemData } from '../../../../_src/utils/itemsData';
import { getMinecraftTextureKey } from '../../../../_src/utils/items/minecraftFallback';

// Item texture image (used by the Discord bot):
//   /api/v1/items/texture?name=<item name>
// Crops the item's 64x64 sprite from the spritesheets. Animated items
// (those with an @keyframes strip in _itemsheet.css) come back as an
// animated GIF; everything else as a PNG. Items without a custom sprite
// fall back to their vanilla Minecraft texture.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CELL = 64;
const SCALE = 2;

let spriteInfo = null;

async function getSpriteInfo() {
    if (spriteInfo) return spriteInfo;
    const base = path.join(process.cwd(), 'public', 'spritesheets');
    const [mapRaw, cssRaw, sheet, animSheet, mcCssRaw, mcSheet] = await Promise.all([
        fs.readFile(path.join(base, 'itemsheet-map.json'), 'utf8'),
        fs.readFile(path.join(base, '_itemsheet.css'), 'utf8'),
        fs.readFile(path.join(base, 'itemsheet.png')),
        fs.readFile(path.join(base, 'itemsheet-anim.png')),
        fs.readFile(path.join(base, '_minecraft.css'), 'utf8'),
        fs.readFile(path.join(base, 'minecraft.png')),
    ]);

    const map = JSON.parse(mapRaw);

    // Sprite position per token (background-position, negated).
    const positions = {};
    const re = /\.monumenta-([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px/g;
    let m;
    while ((m = re.exec(cssRaw))) {
        positions[m[1]] = { x: Math.abs(Number(m[2])), y: Math.abs(Number(m[3])) };
    }

    // Animated textures: the per-item @keyframes strip lists every frame's
    // position (percent of the total duration + x/y offset).
    const animFrames = {};
    const kr = /@keyframes\s+sts-anim-([\w-]+)\s*\{([\s\S]*?)\}/g;
    while ((m = kr.exec(cssRaw))) {
        const frames = [];
        const fr = /(\d+(?:\.\d+)?%)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px/g;
        let f;
        while ((f = fr.exec(m[2]))) {
            frames.push({ pct: parseFloat(f[1]), x: Math.abs(Number(f[2])), y: Math.abs(Number(f[3])) });
        }
        if (frames.length > 0) {
            frames.sort((a, b) => a.pct - b.pct);
            animFrames[m[1]] = frames;
        }
    }

    // Total animation duration per token (from `animation: ... Xms infinite`).
    const durations = {};
    const dr = /animation:\s*sts-anim-([\w-]+)\s+(\d+)ms/g;
    while ((m = dr.exec(cssRaw))) {
        durations[m[1]] = Number(m[2]);
    }

    const mcPositions = {};
    const mcRe = /\.minecraft-([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)(?:px)?/g;
    while ((m = mcRe.exec(mcCssRaw))) {
        mcPositions[m[1]] = { x: Math.abs(Number(m[2])), y: Math.abs(Number(m[3])) };
    }

    spriteInfo = { map, positions, animFrames, durations, sheet, animSheet, mcPositions, mcSheet };
    return spriteInfo;
}

function findSpriteKey(map, itemKey, itemName) {
    const candidates = [
        itemName,
        itemName && itemName.replace(/^EX\s+/, ''),
        itemKey,
        itemKey && itemKey.replace(/^EX\s+/, ''),
        itemKey && itemKey.replace(/-[0-9]+$/, ''),
    ];
    for (const c of candidates) {
        if (c && map[c]) return map[c];
    }
    return null;
}

const imageCache = new Map();

async function renderStatic(sheet, pos) {
    const key = 's' + pos.x + 'x' + pos.y;
    if (imageCache.has(key)) return imageCache.get(key);
    const buf = await sharp(sheet, { limitInputPixels: false })
        .extract({ left: pos.x, top: pos.y, width: CELL, height: CELL })
        .resize(CELL * SCALE, CELL * SCALE, { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();
    imageCache.set(key, buf);
    return buf;
}

// Assemble the keyframe strip into an animated GIF (omggif + per-frame
// local palettes; fully transparent pixels map to a shared transparent
// palette entry so GIF transparency works).
async function renderAnimated(info, spriteKey) {
    const key = 'a' + spriteKey;
    if (imageCache.has(key)) return imageCache.get(key);

    const frames = info.animFrames[spriteKey];
    const durationMs = info.durations[spriteKey] || 1000;
    const w = CELL * SCALE;
    const h = CELL * SCALE;
    const frameRgba = [];
    for (const fr of frames) {
        frameRgba.push(
            await sharp(info.animSheet, { limitInputPixels: false })
                .extract({ left: fr.x, top: fr.y, width: CELL, height: CELL })
                .resize(w, h, { kernel: sharp.kernel.nearest })
                .raw()
                .toBuffer()
        );
    }

    const out = Buffer.alloc(w * h * 3 * frames.length + 1024);
    const writer = new GifWriter(out, w, h, { loop: 0 });
    for (let i = 0; i < frames.length; i++) {
        const nextPct = frames[(i + 1) % frames.length].pct;
        const gapPct = i === frames.length - 1 ? nextPct + 100 - frames[i].pct : nextPct - frames[i].pct;
        const delayCs = Math.max(1, Math.round((gapPct / 100) * (durationMs / 10)));
        const { palette, indices, transparentIndex } = indexFrame(frameRgba[i]);
        writer.addFrame(0, 0, w, h, indices, {
            palette,
            transparent: transparentIndex !== null ? transparentIndex : undefined,
            delay: delayCs,
        });
    }
    const gif = out.slice(0, writer.end());
    imageCache.set(key, gif);
    return gif;
}

// Index an RGBA frame against a per-frame local palette (max 256 colors -
// sprite art is small so this always fits); alpha 0 pixels become the
// palette's transparent entry.
function indexFrame(rgba) {
    const colorIndex = new Map();
    const palette = [];
    let transparentIndex = null;
    const indices = Buffer.alloc(rgba.length / 4);
    for (let i = 0; i < rgba.length; i += 4) {
        const alpha = rgba[i + 3] > 127;
        const key = alpha ? `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}` : 'transparent';
        let idx = colorIndex.get(key);
        if (idx === undefined) {
            if (palette.length >= 256) {
                idx = 0; // defensive; should never trigger
            } else {
                idx = palette.length;
                colorIndex.set(key, idx);
                palette.push(alpha ? [rgba[i], rgba[i + 1], rgba[i + 2]] : [0, 0, 0]);
                if (!alpha && transparentIndex === null) transparentIndex = idx;
            }
        }
        indices[i / 4] = idx;
    }
    // omggif requires palette sizes to be a power of two; pad unused entries.
    const padded = Math.max(2, 1 << Math.ceil(Math.log2(palette.length)));
    while (palette.length < padded) palette.push([0, 0, 0]);
    return { palette, indices, transparentIndex };
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
    if (!name) {
        return NextResponse.json({ error: 'missing name' }, { status: 400 });
    }

    const itemData = await getItemData();
    const item = itemData[name] || Object.values(itemData).find((i) => i.name === name) || null;
    const info = await getSpriteInfo();
    const spriteKey = findSpriteKey(info.map, name, name);

    let body;
    let contentType;
    if (spriteKey && info.animFrames[spriteKey]) {
        body = await renderAnimated(info, spriteKey);
        contentType = 'image/gif';
    } else {
        let pos = spriteKey && info.positions[spriteKey];
        let sheet = info.sheet;
        // Fall back to the vanilla Minecraft texture for the base material.
        if (!pos && item && item.base_item) {
            const mcKey = getMinecraftTextureKey(item.base_item);
            const mcPos = info.mcPositions[mcKey];
            if (mcPos) {
                pos = mcPos;
                sheet = info.mcSheet;
            }
        }
        if (!pos) {
            return NextResponse.json({ error: 'no texture for item' }, { status: 404 });
        }
        body = await renderStatic(sheet, pos);
        contentType = 'image/png';
    }

    return new NextResponse(body, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
        },
    });
}
