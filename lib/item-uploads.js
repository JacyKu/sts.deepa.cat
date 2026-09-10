// Creates custom items from in-game uploads (the mod's /sts upload command
// and builds that reference items the site doesn't know).
//
// The mod sends the item's display data as it exists in the game: name, base
// item, type, the colored lore lines and the Monumenta Stock enchantment
// levels. This module maps that to the site's stat keys (lib/item-lore.js),
// resolves a spritesheet token when the item is known, and stores the item on
// the linked Discord account.

import fs from 'node:fs';
import path from 'node:path';
import { buildStatKeyIndex, mapLoreToStats } from './item-lore.js';
import { hasCustomItemName, saveCustomItem } from './sts-builds.js';

const TOKEN_RE = /^[a-z0-9_]+$/;
const STAT_KEY_RE = /^[a-z0-9_']+$/;

let spriteMapCache = null;
let spriteMapKey = null;

function loadSpriteMap() {
    const file = path.join(process.cwd(), 'public', 'spritesheets', 'itemsheet-map.json');
    try {
        const stat = fs.statSync(file);
        if (spriteMapCache && spriteMapKey === stat.mtimeMs) return spriteMapCache;
        spriteMapCache = JSON.parse(fs.readFileSync(file, 'utf8'));
        spriteMapKey = stat.mtimeMs;
        return spriteMapCache;
    } catch (error) {
        return {};
    }
}

// Finds the spritesheet token for an uploaded item, if the site already has a
// sprite for it (EX items share the base item's sprite).
export function resolveTextureToken(name, textureName) {
    const map = loadSpriteMap();
    for (const candidate of [name, textureName, name && name.replace(/^EX\s+/, '')]) {
        if (!candidate) continue;
        const token = map[candidate];
        if (token && TOKEN_RE.test(token)) return token;
    }
    return null;
}

function sanitizeType(type) {
    return typeof type === 'string' && type.trim() && type.length <= 32 ? type.trim() : 'Miscellaneous';
}

function sanitizeBaseItem(baseItem) {
    if (typeof baseItem !== 'string' || !baseItem.trim()) return null;
    // The mod sends registry ids ("minecraft:diamond_sword"); the site stores
    // display names ("Diamond Sword").
    const cleaned = baseItem
        .trim()
        .split(':')
        .pop()
        .replaceAll('_', ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return null;
    const display = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    return display.slice(0, 64);
}

// items: [{ name, type, baseItem, textureName, lore: [...], enchants: {...}, stats?: {...} }]
// Returns { created: [names], skipped: [{ name, reason }] }.
export function createUploadedCustomItems({ userId, authorName, authorAvatar, items, itemData }) {
    const index = buildStatKeyIndex(itemData);
    const created = [];
    const skipped = [];
    for (const raw of (items || []).slice(0, 50)) {
        const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 64) : '';
        if (!name) {
            skipped.push({ name: '?', reason: 'invalid name' });
            continue;
        }
        if (hasCustomItemName(userId, name)) {
            skipped.push({ name, reason: 'exists' });
            continue;
        }
        const baseItem = sanitizeBaseItem(raw.baseItem);
        const textureToken = resolveTextureToken(name, raw.textureName);
        const { stats, colors } = mapLoreToStats(raw.lore || [], index, { enchants: raw.enchants || {} });
        // Explicit stats (if the mod ever sends them) win over lore parsing.
        if (raw.stats && typeof raw.stats === 'object') {
            for (const [key, value] of Object.entries(raw.stats)) {
                const num = Number(value);
                if (!STAT_KEY_RE.test(key) || key.length > 128 || !Number.isFinite(num) || num === 0) continue;
                stats[key] = num;
            }
        }
        if (Object.keys(stats).length === 0 && !baseItem && !textureToken) {
            skipped.push({ name, reason: 'no item data' });
            continue;
        }
        const item = saveCustomItem({
            userId,
            name,
            type: sanitizeType(raw.type),
            textureToken,
            textureName: name,
            stats,
            statColors: colors,
            baseItem,
            authorName: authorName || null,
            authorAvatar: authorAvatar || null,
        });
        if (item) created.push(name);
        else skipped.push({ name, reason: 'save failed' });
    }
    return { created, skipped };
}

// Names in `items` that the site's item data doesn't know (used to decide
// which equipped build items to auto-create). Checks both keys and display
// names, since itemData keys and item names usually match but not always.
export function findUnknownItemNames(names, itemData) {
    const known = new Set();
    for (const [key, item] of Object.entries(itemData || {})) {
        known.add(key);
        if (item && item.name) known.add(item.name);
    }
    return [...new Set(names || [])].filter((name) => name && !known.has(name));
}
