import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const OUT_DIR = path.join(process.cwd(), 'public', 'spritesheets');
const TMP = path.join(os.tmpdir(), 'sts-vanilla-textures');
const JAR = path.join(TMP, 'client.jar');
const JAR_MIN_SIZE = 20 * 1024 * 1024;
const TILE = 64;

async function getClientJarUrl() {
    const manifest = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
    const latest = manifest.versions.find((v) => v.id === manifest.latest.release);
    if (!latest) throw new Error('no latest release in Mojang manifest');
    const meta = await (await fetch(latest.url)).json();
    const url = meta.downloads?.client?.url;
    if (!url) throw new Error('client.jar URL missing from version metadata');
    console.log(`[minecraft-sheet] vanilla version: ${latest.id}`);
    return url;
}

async function downloadJar(url) {
    try {
        const stat = await fs.stat(JAR);
        if (stat.size > JAR_MIN_SIZE) {
            console.log('[minecraft-sheet] using cached client.jar');
            return;
        }
    } catch (e) {
        // no cache yet
    }
    console.log('[minecraft-sheet] downloading client.jar...');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < JAR_MIN_SIZE) throw new Error(`downloaded jar too small (${buf.length} bytes)`);
    await fs.mkdir(TMP, { recursive: true });
    await fs.writeFile(JAR, buf);
    console.log(`[minecraft-sheet] cached ${(buf.length / 1048576).toFixed(1)} MB jar`);
}

function extractTextures() {
    console.log('[minecraft-sheet] extracting vanilla item/block textures...');
    const dest = path.join(TMP, 'assets');
    try {
        execFileSync(
            'tar',
            ['-xf', JAR, '-C', TMP, 'assets/minecraft/textures/item', 'assets/minecraft/textures/block'],
            {
                stdio: 'pipe',
            }
        );
    } catch (e) {
        throw new Error(`tar extraction failed: ${e.message}`);
    }
    return dest;
}

async function listPngs(dir) {
    const out = [];
    const walk = async (d) => {
        let entries;
        try {
            entries = await fs.readdir(d, { withFileTypes: true });
        } catch (e) {
            return;
        }
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.name.endsWith('.png')) out.push(full);
        }
    };
    await walk(dir);
    return out;
}

function dashedKey(filePath) {
    return path.basename(filePath, '.png').replaceAll('_', '-').toLowerCase();
}

function parseExistingCss(css) {
    const keys = new Set();
    const re = /\.minecraft-([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+);/g;
    let m;
    while ((m = re.exec(css))) {
        keys.add(m[1]);
    }
    return keys;
}

async function main() {
    const cssPath = path.join(OUT_DIR, '_minecraft.css');
    const sheetPath = path.join(OUT_DIR, 'minecraft.webp');
    const existingCss = await fs.readFile(cssPath, 'utf8');
    const existingKeys = parseExistingCss(existingCss);
    const existingMeta = await sharp(sheetPath).metadata();
    const sheetWidth = Math.floor(existingMeta.width / TILE) * TILE;
    const startY = existingMeta.height;

    const url = await getClientJarUrl();
    await downloadJar(url);
    const assetsRoot = extractTextures();

    const itemFiles = (await listPngs(path.join(assetsRoot, 'minecraft', 'textures', 'item'))).sort();
    const blockFiles = (await listPngs(path.join(assetsRoot, 'minecraft', 'textures', 'block'))).sort();

    const byKey = new Map();
    for (const f of itemFiles) {
        const key = dashedKey(f);
        if (!byKey.has(key)) byKey.set(key, f);
    }
    for (const f of blockFiles) {
        const key = dashedKey(f);
        if (!byKey.has(key)) byKey.set(key, f);
    }

    const additions = [];
    for (const [key, file] of byKey) {
        if (existingKeys.has(key)) continue;
        try {
            const buf = await sharp(file, { limitInputPixels: false })
                .resize(TILE, TILE, { kernel: 'nearest', fit: 'fill' })
                .png()
                .toBuffer();
            additions.push({ key, buf });
        } catch (e) {
            console.warn(`  skip ${key}: ${e.message}`);
        }
    }

    if (additions.length === 0) {
        console.log('[minecraft-sheet] nothing to add, sheet is complete.');
        return;
    }

    console.log(
        `[minecraft-sheet] adding ${additions.length} missing textures (${itemFiles.length} items, ${blockFiles.length} blocks scanned)`
    );

    const tilesPerRow = Math.floor(sheetWidth / TILE);
    const newRules = [];
    const composites = [];
    additions.forEach(({ key, buf }, i) => {
        const x = (i % tilesPerRow) * TILE;
        const y = startY + Math.floor(i / tilesPerRow) * TILE;
        composites.push({ input: buf, left: x, top: y });
        newRules.push(`.minecraft-${key} {\n\tbackground-position: -${x}px -${y}px;\n}`);
    });

    const baseImg = await sharp(sheetPath).toBuffer();
    const newSheet = await sharp({
        create: {
            width: sheetWidth,
            height: startY + Math.ceil(additions.length / tilesPerRow) * TILE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: baseImg, left: 0, top: 0 }, ...composites])
        .webp({ lossless: true, effort: 6 })
        .toBuffer();

    await Promise.all([
        fs.writeFile(sheetPath, newSheet),
        fs.writeFile(cssPath, existingCss.replace(/\s*$/, '\n') + newRules.join('\n') + '\n'),
    ]);

    console.log(
        `[minecraft-sheet] wrote minecraft.webp (${(newSheet.length / 1024) | 0} KB) and _minecraft.css (+${newRules.length} rules)`
    );
}

main().catch((err) => {
    console.error('[minecraft-sheet] failed:', err.message);
    process.exit(1);
});
