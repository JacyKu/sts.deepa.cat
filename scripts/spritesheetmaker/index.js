const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

const SPRITE_SIZE = 64;
const OUTPUT_NAME = "itemsheet";
const CLASS_PREFIX = "monumenta";
const BASE_CLASS = `${CLASS_PREFIX}-items`;
const INCLUDE_MINECRAFT_COLORS = false;
const RESIZE_IMAGES_TO_SPRITE_SIZE = true;

// Set STS_PACK_ZIP to point at a different Monumenta resource pack zip.
const ZIP_PATH = process.env.STS_PACK_ZIP || path.join(__dirname, "MonumentaRP_v6.3.0.zip");
const ASSETS_ROOT = "assets/";
const OUTPUT_DIR = path.join(__dirname, "..", "..", "public", "spritesheets");
const ITEM_DATA_PATH = path.join(__dirname, "..", "..", "public", "items", "items.json");
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SHARP_CONCURRENCY = Math.max(1, os.cpus().length - 1);
const SHARP_CACHE = false;

function normalizeBaseToken(value) {
    const baseName = String(value || "");
    return baseName
        .replaceAll("-", "_")
        .replaceAll(" ", "_")
        .replaceAll("'", "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

function spriteClassNameForEntry(entryName) {
    const baseName = path.basename(entryName, path.extname(entryName));
    const baseToken = normalizeBaseToken(baseName);
    const hash = crypto.createHash('sha1').update(entryName).digest('hex').slice(0, 8);
    return `${baseToken}_${hash}`;
}

function shouldExcludeFromSheet(entryName) {
    const e = String(entryName || '').toLowerCase();

    // Explicit exclusion requested.
    if (e.startsWith('assets/minecraft/optifine/mob/')) return true;

    const baseName = path.basename(e, path.extname(e));

    // Exclude state textures from the sheet across the entire pack.
    // Matches: *_pulling, *_pulling_0, *_pulling_0_e, *_charged, *_firework, *_arrow, etc.
    if (/(^|_)pulling($|_)/.test(baseName)) return true;
    if (/(^|_)charged($|_)/.test(baseName)) return true;
    if (/(^|_)firework($|_)/.test(baseName)) return true;
    if (/(^|_)arrow($|_)/.test(baseName)) return true;

    return false;
}

function isPatternValue(value) {
    return /^(i?pattern|regex|iregex):/i.test(value) || /[\*\?]/.test(value);
}

function sanitizeDisplayName(value) {
    return value
        .replace(/\u00a7[0-9a-fk-or]/gi, "")
        .replace(/§[0-9a-fk-or]/gi, "")
        .replace(/Â§[0-9a-fk-or]/gi, "")
        .trim();
}

function normalizeNameKey(value) {
    return sanitizeDisplayName(value)
        .replace(/^EX\s+/i, "")
        .replace(/\(.*?\)/g, "")
        .replace(/["'’]/g, "")
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .toLowerCase();
}

function stripTrailingNumericSuffix(value) {
    // Many masterwork items are keyed as "Name-4" while their display name is just "Name".
    return String(value || "").replace(/-\d+\s*$/g, "");
}

function pickTexture(textures) {
    if (!textures.length) return null;
    const withScore = textures.map((entry) => {
        const value = entry.value.toLowerCase();
        let score = 0;
        if (value.includes("_icon")) score += 3;
        if (value.includes("icon")) score += 1;
        if (!value.includes("layer")) score += 2;
        if (!value.includes("armor")) score += 1;
        if (value.includes("_blank")) score -= 2;
        if (value.includes("overlay")) score -= 1;
        if (entry.key === "texture") score += 1;
        return { ...entry, score };
    });
    withScore.sort((a, b) => b.score - a.score);
    return withScore[0].value;
}

function pickTextureForItemsValue(textures, itemsValue) {
    if (!textures.length) return null;
    if (!isBowOrCrossbowItemsValue(itemsValue)) {
        return pickTexture(textures);
    }

    const score = (entry) => {
        const key = String(entry.key || '').toLowerCase();
        const value = String(entry.value || '').toLowerCase();
        let s = scoreTextureName(value);
        if (key.includes('standby') || value.includes('standby')) s += 100;
        if (value.includes('pulling')) s -= 50;
        if (value.includes('charged')) s -= 50;
        if (value.includes('firework')) s -= 50;
        return s;
    };

    const sorted = [...textures].sort((a, b) => score(b) - score(a));
    return sorted[0].value;
}

function normalizeTextureValue(value) {
    const trimmed = value.trim();
    const withoutExt = path.basename(trimmed, path.extname(trimmed));
    return withoutExt;
}

function parsePropertiesText(text, propertiesEntryName) {
    const lines = text.split(/\r?\n/);
    let displayName = null;
    const textures = [];
    let model = null;
    let items = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }
        const splitIndex = line.indexOf("=");
        if (splitIndex === -1) {
            continue;
        }
        const key = line.slice(0, splitIndex).trim();
        const value = line.slice(splitIndex + 1).trim();
        if (!value) {
            continue;
        }
        if (key.includes("display.Name")) {
            displayName = value;
        }
        if (key.startsWith("texture")) {
            textures.push({ key, value });
        }
        if (key === "model") {
            model = value;
        }
        if (key === "items") {
            items = value;
        }
    }

    if (!displayName) {
        return null;
    }
    if (isPatternValue(displayName)) {
        return null;
    }

    const cleanName = sanitizeDisplayName(displayName);
    const normalizedName = normalizeNameKey(displayName);
    if (!cleanName || !normalizedName) {
        return null;
    }

    const textureValue = pickTextureForItemsValue(textures, items);

    return {
        name: cleanName,
        nameKey: normalizedName,
        propertiesEntryName,
        // Keep raw values here; resolution to a specific png happens later.
        texture: textureValue ? textureValue.trim() : null,
        textures,
        model: model ? model.trim() : null
        ,items: items ? items.trim() : null
    };
}

function isBowOrCrossbowItemsValue(itemsValue) {
    if (!itemsValue) return false;
    const v = String(itemsValue).toLowerCase();
    // OptiFine supports comma/space separated lists; we only need a heuristic.
    return v.includes('bow') || v.includes('crossbow');
}

function normalizeBowCrossbowTextureRef(textureRef) {
    if (!textureRef) return textureRef;
    const v = String(textureRef);

    // Prefer explicit standby naming if present.
    // (We don't force it if the pack doesn't use standby naming.)
    if (/standby/i.test(v)) return v;

    // Strip common animation state suffixes.
    // Examples:
    // - something_bow_pulling_0 -> something_bow
    // - crossbow_pulling_2 -> crossbow
    // - crossbow_charged -> crossbow
    // - crossbow_firework -> crossbow
    return v
        .replace(/(_pulling_\d+)(_[a-z0-9]+)?$/i, '')
        .replace(/(_pulling)(_[a-z0-9]+)?$/i, '')
        .replace(/(_charged)(_[a-z0-9]+)?$/i, '')
        .replace(/(_firework)(_[a-z0-9]+)?$/i, '')
        .replace(/(_arrow)(_[a-z0-9]+)?$/i, '');
}

function scoreTextureName(value) {
    const v = (value || "").toLowerCase();
    let score = 0;
    if (v.includes("_icon")) score += 10;
    else if (v.includes("icon")) score += 4;
    if (v.includes("layer")) score -= 6;
    if (v.includes("armor")) score -= 4;
    if (v.includes("_blank")) score -= 6;
    if (v.includes("overlay")) score += 1;
    return score;
}

function resolveModelEntryCandidates(modelValue) {
    if (!modelValue) return [];
    const trimmed = modelValue.trim();
    const withExt = trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`;

    // Model refs can be namespaced (e.g. minecraft:item/potion)
    if (withExt.includes(':')) {
        const [namespace, rest] = withExt.split(':', 2);
        if (namespace === 'minecraft') {
            return [`assets/minecraft/models/${rest}`, `assets/minecraft/${rest}`];
        }
        return [`assets/${namespace}/models/${rest}`, `assets/${namespace}/${rest}`];
    }

    // If the .properties already points at an assets/ path, try it as-is and also under models/.
    if (withExt.startsWith('assets/')) {
        if (withExt.startsWith('assets/minecraft/models/')) {
            return [withExt];
        }
        if (withExt.startsWith('assets/minecraft/')) {
            const rest = withExt.slice('assets/minecraft/'.length);
            return [withExt, `assets/minecraft/models/${rest}`];
        }
        return [withExt];
    }

    // In packs, model paths are often relative to assets/minecraft/models, but some packs store them directly under assets/minecraft/.
    return [`assets/minecraft/models/${withExt}`, `assets/minecraft/${withExt}`];
}

function resolveTextureEntryCandidates(propertiesEntryName, textureValue) {
    if (!textureValue) return [];
    const trimmed = textureValue.trim();

    // Some values include a namespace or a rooted-ish path.
    // Examples:
    // - riftwalker_boots_icon
    // - optifine/cit/.../potion_overlay
    // - minecraft:item/potion
    let normalized = trimmed;
    // strip surrounding quotes if present
    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
        normalized = normalized.slice(1, -1);
    }

    const candidates = [];
    const ensurePng = (value) => (value.toLowerCase().endsWith('.png') ? value : `${value}.png`);

    if (normalized.includes(':')) {
        const [namespace, rest] = normalized.split(':', 2);
        if (namespace === 'minecraft') {
            // Best-effort mapping for vanilla texture refs.
            candidates.push(`assets/minecraft/textures/${ensurePng(rest)}`);
            candidates.push(`assets/minecraft/${ensurePng(rest)}`);
        } else {
            candidates.push(`assets/${namespace}/textures/${ensurePng(rest)}`);
            candidates.push(`assets/${namespace}/${ensurePng(rest)}`);
        }
    } else if (normalized.includes('/')) {
        // Texture refs in models are usually relative to assets/minecraft/textures/
        candidates.push(`assets/minecraft/textures/${ensurePng(normalized)}`);
        candidates.push(`assets/minecraft/${ensurePng(normalized)}`);
    } else {
        const dir = path.posix.dirname(propertiesEntryName);
        candidates.push(`${dir}/${ensurePng(normalized)}`);
        // Common alternative layout
        candidates.push(`${dir}/textures/${ensurePng(normalized)}`);
        candidates.push(`assets/minecraft/textures/${ensurePng(normalized)}`);
    }

    return candidates;
}

function pickModelTextureValue(modelJson) {
    if (!modelJson || typeof modelJson !== 'object') return null;
    const textures = modelJson.textures;
    if (!textures || typeof textures !== 'object') return null;

    // Potion-style models often use layer0 as a mostly-transparent overlay and layer1 as the actual bottle.
    // For UI icons we want something visible, so prefer layer1 when layer0 looks like an overlay.
    if (typeof textures.layer0 === 'string' && typeof textures.layer1 === 'string') {
        const l0 = textures.layer0.toLowerCase();
        const l1 = textures.layer1.toLowerCase();
        if (l0.includes('overlay') && (l1.includes('potion') || l1.includes('bottle') || l1.includes('glass'))) {
            return textures.layer1;
        }
    }

    const entries = Object.entries(textures);
    if (!entries.length) return null;

    // Prefer layer0, then layer1, then anything.
    entries.sort((a, b) => {
        const aKey = a[0];
        const bKey = b[0];
        const rank = (key) => {
            if (key === 'layer0') return 0;
            if (key === 'layer1') return 1;
            if (key.startsWith('layer')) return 2;
            return 3;
        };
        return rank(aKey) - rank(bKey);
    });

    return entries[0][1];
}

function resolveFirstExistingEntry(zip, candidates) {
    for (const candidate of candidates) {
        if (candidate && zip.getEntry(candidate)) return candidate;
    }
    return null;
}

async function compositeLayers(buffers) {
    // Buffers are in draw order (bottom first); each is composited on top of the previous.
    let result = await sharp(buffers[0], { sequentialRead: true })
        .resize(SPRITE_SIZE, SPRITE_SIZE, { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();
    for (let i = 1; i < buffers.length; i++) {
        const layer = await sharp(buffers[i], { sequentialRead: true })
            .resize(SPRITE_SIZE, SPRITE_SIZE, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();
        result = await sharp(result)
            .composite([{ input: layer, blend: 'over' }])
            .png()
            .toBuffer();
    }
    return result;
}

async function buildCompositePotionSprite({ baseBuffer, overlayBuffer }) {
    return compositeLayers([baseBuffer, overlayBuffer]);
}

// Collects every layerN texture ref from a model in ascending layer order.
function collectModelLayers(modelJson) {
    if (!modelJson || typeof modelJson.textures !== 'object') return [];
    const layers = [];
    for (const [key, value] of Object.entries(modelJson.textures)) {
        const match = key.match(/^layer(\d+)$/);
        if (match && typeof value === 'string') {
            layers.push({ index: Number(match[1]), value });
        }
    }
    layers.sort((a, b) => a.index - b.index);
    return layers.map((l) => l.value);
}

// Layer refs whose name suggests an overlay are composited last (on top).
function orderLayerRefs(refs) {
    const overlays = refs.filter((r) => /overlay/i.test(r));
    const base = refs.filter((r) => !/overlay/i.test(r));
    return [...base, ...overlays];
}

function parseCitMappings(zip, spriteClassByEntryName, ensureGeneratedSprite) {
    const entries = zip.getEntries()
        .filter((entry) => entry.entryName.includes("/cit/") && entry.entryName.endsWith(".properties"));

    const mapping = new Map();
    for (const entry of entries) {
        const parsed = parsePropertiesText(entry.getData().toString("utf8"), entry.entryName);
        if (!parsed) {
            continue;
        }

        let textureRef = parsed.texture;
        let textureScore = scoreTextureName(textureRef);

        if (!textureRef && parsed.model) {
            const modelCandidates = resolveModelEntryCandidates(parsed.model);
            for (const modelEntryName of modelCandidates) {
                const modelEntry = modelEntryName ? zip.getEntry(modelEntryName) : null;
                if (!modelEntry) continue;
                try {
                    const modelJson = JSON.parse(modelEntry.getData().toString('utf8'));

                    // If the model references multiple layers, generate a composite sprite
                    // that renders every layer instead of picking just one texture.
                    const layerRefs = collectModelLayers(modelJson);
                    if (layerRefs.length >= 2 && ensureGeneratedSprite) {
                        const layerEntryNames = [];
                        let missing = false;
                        for (const ref of orderLayerRefs(layerRefs)) {
                            const candidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, ref);
                            const entryName = resolveFirstExistingEntry(zip, candidates);
                            if (!entryName) {
                                missing = true;
                                break;
                            }
                            layerEntryNames.push(entryName);
                        }
                        if (!missing) {
                            const generated = ensureGeneratedSprite({
                                kind: 'layers-composite',
                                key: `${parsed.propertiesEntryName}::layers::${layerEntryNames.join('|')}`,
                                layerEntryNames
                            });
                            if (generated && generated.spriteClassName) {
                                const existing = mapping.get(parsed.nameKey);
                                if (!existing || 9999 > existing.score) {
                                    mapping.set(parsed.nameKey, { className: generated.spriteClassName, score: 9999 });
                                }
                                textureRef = null;
                                break;
                            }
                        }
                    }

                    // If this is a potion-style model with layer0+layer1, generate a composite sprite.
                    const textures = modelJson && modelJson.textures;
                    if (textures && typeof textures === 'object' && typeof textures.layer0 === 'string' && typeof textures.layer1 === 'string') {
                        const overlayCandidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, textures.layer0);
                        const baseCandidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, textures.layer1);
                        const overlayEntryName = resolveFirstExistingEntry(zip, overlayCandidates);
                        const baseEntryName = resolveFirstExistingEntry(zip, baseCandidates);

                        if (overlayEntryName && baseEntryName && ensureGeneratedSprite) {
                            const generated = ensureGeneratedSprite({
                                kind: 'potion-composite',
                                key: `${parsed.propertiesEntryName}::potion-composite`,
                                baseEntryName,
                                overlayEntryName
                            });
                            if (generated && generated.spriteClassName) {
                                const existing = mapping.get(parsed.nameKey);
                                if (!existing || 9999 > existing.score) {
                                    mapping.set(parsed.nameKey, { className: generated.spriteClassName, score: 9999 });
                                }
                                textureRef = null;
                                break;
                            }
                        }
                    }

                    textureRef = pickModelTextureValue(modelJson);
                    textureScore = scoreTextureName(textureRef);
                    break;
                } catch {
                    // ignore invalid JSON
                }
            }
        }

        // Multi-layer CIT textures (texture.1=, texture.2=, ...) are composited in order.
        if (textureRef && ensureGeneratedSprite) {
            const layeredRefs = (parsed.textures || [])
                .filter((t) => /^texture\.\d+$/.test(t.key))
                .sort((a, b) => Number(a.key.split('.')[1]) - Number(b.key.split('.')[1]))
                .map((t) => t.value);
            if (layeredRefs.length >= 2) {
                const layerEntryNames = [];
                let missing = false;
                for (const ref of orderLayerRefs(layeredRefs)) {
                    const candidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, ref);
                    const entryName = resolveFirstExistingEntry(zip, candidates);
                    if (!entryName) {
                        missing = true;
                        break;
                    }
                    layerEntryNames.push(entryName);
                }
                if (!missing) {
                    const generated = ensureGeneratedSprite({
                        kind: 'layers-composite',
                        key: `${parsed.propertiesEntryName}::layers::${layerEntryNames.join('|')}`,
                        layerEntryNames
                    });
                    if (generated && generated.spriteClassName) {
                        mapping.set(parsed.nameKey, { className: generated.spriteClassName, score: 9999 });
                        textureRef = null;
                    }
                }
            }
        }

        if (!textureRef) {
            continue;
        }

        // For bows/crossbows, only map the standby/base texture (not pulling/charged variants).
        if (isBowOrCrossbowItemsValue(parsed.items)) {
            const normalized = normalizeBowCrossbowTextureRef(textureRef);
            const preferredRefs = [];

            // Prefer an explicit standby texture if the pack provides one.
            if (!/standby/i.test(normalized)) {
                preferredRefs.push(`${normalized}_standby`);
            }
            preferredRefs.push(normalized);
            preferredRefs.push(textureRef);

            let chosen = null;
            for (const ref of preferredRefs) {
                const candidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, ref);
                if (candidates.some((c) => zip.getEntry(c))) {
                    chosen = ref;
                    break;
                }
            }

            if (chosen) {
                textureRef = chosen;
                textureScore = scoreTextureName(textureRef);
            }
        }

        const candidates = resolveTextureEntryCandidates(parsed.propertiesEntryName, textureRef);
        let resolvedEntryName = null;
        for (const candidate of candidates) {
            if (zip.getEntry(candidate)) {
                resolvedEntryName = candidate;
                break;
            }
        }

        if (!resolvedEntryName) {
            continue;
        }

        const spriteClassName = spriteClassByEntryName.get(resolvedEntryName);
        if (!spriteClassName) {
            continue;
        }

        const existing = mapping.get(parsed.nameKey);
        if (!existing || textureScore > existing.score) {
            mapping.set(parsed.nameKey, { className: spriteClassName, score: textureScore });
        }
    }

    const result = new Map();
    for (const [key, value] of mapping.entries()) {
        result.set(key, value.className);
    }
    return result;
}

async function loadZipImages(zip) {
    const entries = zip.getEntries()
        .filter((entry) => !entry.isDirectory)
        .filter((entry) => entry.entryName.startsWith(ASSETS_ROOT))
        .filter((entry) => !shouldExcludeFromSheet(entry.entryName))
        .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry.entryName).toLowerCase()))
        .sort((a, b) => a.entryName.localeCompare(b.entryName));

    console.log(`[spritesheet] Found ${entries.length} image(s) under ${ASSETS_ROOT}`);

    const mcmeta = new Set(
        zip.getEntries()
            .filter((e) => !e.isDirectory)
            .filter((e) => e.entryName.startsWith(ASSETS_ROOT))
            .filter((e) => !shouldExcludeFromSheet(e.entryName))
            .filter((e) => e.entryName.toLowerCase().endsWith('.png.mcmeta'))
            .map((e) => e.entryName)
    );

    return entries.map((entry) => ({
        name: entry.entryName,
        buffer: entry.getData(),
        isAnimated: mcmeta.has(`${entry.entryName}.mcmeta`)
    }));
}

async function main() {
    sharp.concurrency(SHARP_CONCURRENCY);
    sharp.cache(SHARP_CACHE);

    console.log("[spritesheet] Starting spritesheet build...");
    console.log(`[spritesheet] Zip: ${ZIP_PATH}`);
    console.log(`[spritesheet] Output dir: ${OUTPUT_DIR}`);
    console.log(`[spritesheet] Sharp concurrency: ${SHARP_CONCURRENCY}, cache: ${SHARP_CACHE}`);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    let zip;
    try {
        zip = new AdmZip(ZIP_PATH);
    } catch (error) {
        throw new Error(`Unable to open zip file at ${ZIP_PATH}`);
    }

    const images = await loadZipImages(zip);
    const imageCount = images.length;
    if (imageCount === 0) {
        throw new Error(`No images found under ${ASSETS_ROOT} in ${ZIP_PATH}`);
    }

    // Build a quick lookup for sprite generation.
    const bufferByEntryName = new Map(images.map((img) => [img.name, img.buffer]));

    // Pre-compute sprite class names for all zip entries so CIT mapping can reference them.
    const spriteClassByEntryName = new Map();
    for (const image of images) {
        spriteClassByEntryName.set(image.name, spriteClassNameForEntry(image.name));
    }

    const generatedImages = [];
    const generatedByKey = new Map();

    const ensureGeneratedSprite = ({ kind, key, baseEntryName, overlayEntryName, layerEntryNames }) => {
        if (!key) return null;
        const cached = generatedByKey.get(key);
        if (cached) return cached;

        if (kind === 'layers-composite') {
            const syntheticEntryName = `__generated__/layers_composite/${crypto.createHash('sha1').update(key).digest('hex').slice(0, 12)}.png`;
            const spriteClassName = spriteClassNameForEntry(syntheticEntryName);
            const record = { syntheticEntryName, spriteClassName };
            generatedByKey.set(key, record);

            const buffers = (layerEntryNames || [])
                .map((en) => bufferByEntryName.get(en) || zip.getEntry(en)?.getData())
                .filter(Boolean);
            if (buffers.length < 2) {
                return null;
            }

            record._buildPromise = compositeLayers(buffers).then((buf) => {
                bufferByEntryName.set(syntheticEntryName, buf);
                spriteClassByEntryName.set(syntheticEntryName, spriteClassName);
                generatedImages.push({ name: syntheticEntryName, buffer: buf, isAnimated: false });
            });
            return record;
        }

        if (kind === 'potion-composite') {
            const syntheticEntryName = `__generated__/potion_composite/${crypto.createHash('sha1').update(key).digest('hex').slice(0, 12)}.png`;
            const spriteClassName = spriteClassNameForEntry(syntheticEntryName);
            const record = { syntheticEntryName, spriteClassName };
            generatedByKey.set(key, record);

            // Defer actual buffer creation until we've confirmed source buffers exist.
            const baseBuffer = bufferByEntryName.get(baseEntryName) || zip.getEntry(baseEntryName)?.getData();
            const overlayBuffer = bufferByEntryName.get(overlayEntryName) || zip.getEntry(overlayEntryName)?.getData();
            if (!baseBuffer || !overlayBuffer) {
                return null;
            }

            // Create the composite buffer and register it as an additional image.
            // Note: this is sync-ish via async work queued below.
            record._buildPromise = buildCompositePotionSprite({ baseBuffer, overlayBuffer }).then((buf) => {
                bufferByEntryName.set(syntheticEntryName, buf);
                spriteClassByEntryName.set(syntheticEntryName, spriteClassName);
                generatedImages.push({ name: syntheticEntryName, buffer: buf, isAnimated: false });
            });
            return record;
        }

        return null;
    };

    const baseTokenToClasses = new Map();

    // Generate CIT mapping before building the sheet so we can add synthetic sprites.
    const citMap = parseCitMappings(zip, spriteClassByEntryName, ensureGeneratedSprite);
    // Wait for any synthetic sprite buffers to finish building.
    const pendingBuilds = [...generatedByKey.values()].map((r) => r._buildPromise).filter(Boolean);
    if (pendingBuilds.length) {
        console.log(`[spritesheet] Building ${pendingBuilds.length} generated sprite(s)...`);
        await Promise.all(pendingBuilds);
    }

    const allImages = images.concat(generatedImages);

    const composite = [];
    let failedImages = 0;
    const spritesPerRow = Math.ceil(Math.sqrt(allImages.length));
    let compositeX = 0;
    let compositeY = 0;

    for (const image of allImages) {
        if (composite.length % 250 === 0) {
            console.log(`[spritesheet] Processing image ${composite.length + 1}/${allImages.length}`);
        }
        try {
            let inputBuffer = image.buffer;
            let imageSharp = sharp(image.buffer, { sequentialRead: true });
            const metadata = await imageSharp.metadata();

            // If the texture is animated (has .png.mcmeta), it is typically a strip of frames.
            // For the site spritesheet we want the default/first frame, so crop to the first 64x64 frame.
            if (image.isAnimated && metadata.width && metadata.height) {
                // Minecraft animated textures are usually a strip of square frames.
                // Frame size is typically the smallest dimension (commonly width).
                const frameSize = Math.min(metadata.width, metadata.height);
                if (metadata.width !== metadata.height) {
                    imageSharp = imageSharp.extract({
                        left: 0,
                        top: 0,
                        width: frameSize,
                        height: frameSize
                    });
                }
            }

            if (RESIZE_IMAGES_TO_SPRITE_SIZE) {
                inputBuffer = await imageSharp
                    .resize(SPRITE_SIZE, SPRITE_SIZE, { kernel: sharp.kernel.nearest })
                    .toBuffer();
            } else {
                inputBuffer = await imageSharp.toBuffer();
            }

            const spriteClassName = spriteClassNameForEntry(image.name);
            const baseName = path.basename(image.name, path.extname(image.name));
            const baseToken = normalizeBaseToken(baseName);

            spriteClassByEntryName.set(image.name, spriteClassName);
            if (!baseTokenToClasses.has(baseToken)) {
                baseTokenToClasses.set(baseToken, []);
            }
            baseTokenToClasses.get(baseToken).push(spriteClassName);

            composite.push({
                input: inputBuffer,
                left: compositeX * SPRITE_SIZE,
                top: compositeY * SPRITE_SIZE,
                name: image.name,
                className: spriteClassName
            });
            if (compositeX + 1 === spritesPerRow) {
                compositeX = 0;
                compositeY++;
            } else {
                compositeX++;
            }
        } catch (error) {
            failedImages++;
            console.warn(`[spritesheet] Skipped ${image.name}: ${error.message}`);
        }
    }
    
    console.log(`[spritesheet] Compositing image sheet with ${composite.length} sprites (${failedImages} skipped)...`);
        console.time("[spritesheet] Composite time");
        await sharp({
        create: {
            width: spritesPerRow * SPRITE_SIZE,
            height: spritesPerRow * SPRITE_SIZE,
            channels: 4,
            background: {r: 0, g: 0, b: 0, alpha: 0}
        }
    })
    .composite(composite)
    .toFile(path.join(OUTPUT_DIR, `${OUTPUT_NAME}.png`));
        console.timeEnd("[spritesheet] Composite time");

    // Create all the css classes and shove them into a file
    let stylesFile = "";

    if (INCLUDE_MINECRAFT_COLORS) {
        // Add the color classes
        stylesFile +=
            ".minecraft-color-black {\n" +
                "\tcolor: #000000;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-blue {\n" +
                "\tcolor: #0000AA;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-green {\n" +
                "\tcolor: #00AA00;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-aqua {\n" +
                "\tcolor: #00AAAA;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-red {\n" +
                "\tcolor: #AA0000;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-purple {\n" +
                "\tcolor: #AA00AA;\n" +
            "}\n\n" +
    
            ".minecraft-color-gold {\n" +
                "\tcolor: #FFAA00;\n" +
            "}\n\n" +
    
            ".minecraft-color-gray {\n" +
                "\tcolor: #AAAAAA;\n" +
            "}\n\n" +
    
            ".minecraft-color-dark-gray {\n" +
                "\tcolor: #555555;\n" +
            "}\n\n" +
    
            ".minecraft-color-blue {\n" +
                "\tcolor: #5555FF;\n" +
            "}\n\n" +
    
            ".minecraft-color-green {\n" +
                "\tcolor: #55FF55;\n" +
            "}\n\n" +
    
            ".minecraft-color-aqua {\n" +
                "\tcolor: #55FFFF;\n" +
            "}\n\n" +
    
            ".minecraft-color-red {\n" +
                "\tcolor: #FF5555;\n" +
            "}\n\n" +
    
            ".minecraft-color-light-purple {\n" +
                "\tcolor: #FF55FF;\n" +
            "}\n\n" +
    
            ".minecraft-color-yellow {\n" +
                "\tcolor: #FFFF55;\n" +
            "}\n\n" +
    
            ".minecraft-color-white {\n" +
                "\tcolor: #FFFFFF;\n" +
            "}\n\n"
    }
    stylesFile +=
        `.${BASE_CLASS} {\n` +
            `\tbackground-image: url("./${OUTPUT_NAME}.png");\n` +
            "\tbackground-repeat: no-repeat;\n" +
            "\tdisplay: inline-block;\n" +
            "\tvertical-align: middle;\n" +
            `\twidth: ${SPRITE_SIZE}px;\n` +
            `\theight: ${SPRITE_SIZE}px;\n` +
        "}\n\n";
    // Now add all the block classes
    for (const comp of composite) {
        stylesFile += `.${CLASS_PREFIX}-${comp.className} {\n`;
        stylesFile  += `\tbackground-position: ${(comp.left !== 0) ? `-${comp.left}px` : "0"} ${(comp.top !== 0) ? `-${comp.top}px` : "0"};\n`;
        stylesFile += "}\n\n";
    }
    await fs.writeFile(path.join(OUTPUT_DIR, `_${OUTPUT_NAME}.css`), stylesFile);

    console.log(`[spritesheet] Loaded ${citMap.size} CIT name mappings`);
    let itemData = {};
    try {
        itemData = JSON.parse(await fs.readFile(ITEM_DATA_PATH, "utf8"));
    } catch (error) {
        console.warn(`[spritesheet] Unable to load item data for mapping: ${error.message}`);
    }

    const itemMap = {};
    for (const itemKey of Object.keys(itemData)) {
        const item = itemData[itemKey] || {};
        const displayName = item.name || itemKey;
        const strippedKey = stripTrailingNumericSuffix(itemKey);

        // Prefer matching via CIT display names (nbt.plain.display.Name).
        const lookupKeys = [
            normalizeNameKey(displayName),
            normalizeNameKey(strippedKey),
            normalizeNameKey(itemKey)
        ].filter(Boolean);

        let mappedClass = null;
        for (const lookupKey of lookupKeys) {
            const citClass = citMap.get(lookupKey);
            if (citClass) {
                mappedClass = citClass;
                break;
            }
        }

        // Fallback: direct texture filename match.
        if (!mappedClass) {
            const fallbackCandidates = [displayName, strippedKey, itemKey]
                .map((name) => normalizeBaseToken(String(name).replace(/^EX\s+/i, "").replace(/\(.*\)/g, "").trim()))
                .filter(Boolean);

            for (const token of fallbackCandidates) {
                const classes = baseTokenToClasses.get(token);
                if (classes && classes.length === 1) {
                    mappedClass = classes[0];
                    break;
                }
            }
        }

        if (!mappedClass) {
            continue;
        }

        // Emit mapping for both the display name (what the UI usually uses) and the raw key (used for non-ASCII edge cases).
        if (!itemMap[displayName]) {
            itemMap[displayName] = mappedClass;
        }
        if (!itemMap[itemKey]) {
            itemMap[itemKey] = mappedClass;
        }
    }

    await fs.writeFile(path.join(OUTPUT_DIR, `${OUTPUT_NAME}-map.json`), JSON.stringify(itemMap, null, 2));
    console.log(`[spritesheet] Wrote ${OUTPUT_NAME}.png and _${OUTPUT_NAME}.css`);
    console.log(`[spritesheet] Wrote ${OUTPUT_NAME}-map.json with ${Object.keys(itemMap).length} entries`);
    if (failedImages > 0) {
        console.warn(`[spritesheet] Completed with ${failedImages} skipped images. See warnings above for details.`);
    }
}

main().catch((error) => {
    console.error("[spritesheet] Failed:", error);
    process.exit(1);
});