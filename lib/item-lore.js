// Maps an in-game item's rendered lore lines to the site's stat keys.
//
// Items uploaded from the game (the mod's /sts upload command, or builds that
// reference items the site doesn't know) arrive as their display lore: JSON
// text components such as
//   {"color":"dark_green","text":"4 Attack Damage"}
//   {"color":"#4AC2E5","text":"+25% Spiritual Combos Damage"}
//   {"color":"gray","text":"Magic Protection IV"}
// This module turns those lines into { stats: { key: value }, colors:
// { key: "#RRGGBB" } } using the site's item data as the key catalog, so the
// values match what the API would report and the colors match the game.

import { colorToHex } from './minecraft-colors.js';

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

// Lore lines that look stat-like but are item metadata.
const SKIP_LABELS = new Set(['tier', 'region', 'level', 'tier i', 'tier ii', 'tier iii', 'tier iv', 'tier v']);

// Internal Stock enchant flags that are not real enchantments.
const SKIP_ENCHANTS = new Set(['offhandmainhanddisable', 'mainhandoffhanddisable']);

// The API stores a few stats in different units than the in-game lore shows.
// (potion recharge: lore "1.1" = API 110; knockback resistance: lore "+20%" =
// API 2, i.e. one API unit per 10%.)
function convertValue(key, value, loreText) {
    if (key === 'potion_recharge_rate_percent') return Math.round(value * 100);
    if (key === 'knockback_resistance_flat' && /%/.test(loreText)) return value / 10;
    return value;
}

function normalizeLabel(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_']/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Walks a text component (or plain string), flattening it to one line with
// inherited color.
function flattenComponent(component, inheritedColor, out) {
    if (component === null || component === undefined) return;
    if (typeof component === 'string') {
        out.push({ text: component, color: inheritedColor });
        return;
    }
    if (Array.isArray(component)) {
        for (const entry of component) flattenComponent(entry, inheritedColor, out);
        return;
    }
    if (typeof component !== 'object') return;
    const color = colorToHex(component.color) || inheritedColor;
    if (typeof component.text === 'string') out.push({ text: component.text, color });
    if (Array.isArray(component.extra)) {
        for (const entry of component.extra) flattenComponent(entry, color, out);
    }
}

// Parses an array of lore entries (JSON component strings or plain strings)
// into flat { text, color } lines.
export function parseLoreLines(lines) {
    const parsed = [];
    for (const raw of lines || []) {
        let component = raw;
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
                try {
                    component = JSON.parse(trimmed);
                } catch (error) {
                    component = raw;
                }
            }
        }
        const parts = [];
        flattenComponent(component, null, parts);
        const text = parts.map((p) => p.text).join('');
        const color = parts.find((p) => p.color)?.color || null;
        parsed.push({ text, color });
    }
    return parsed;
}

// Builds the stat-key catalog index from the site's item data.
export function buildStatKeyIndex(itemData) {
    const keys = new Set();
    for (const item of Object.values(itemData || {})) {
        for (const key of Object.keys(item.stats || {})) keys.add(key);
    }
    const byBase = new Map();
    for (const key of keys) {
        const base = key.replace(/_(percent|flat|base)$/, '');
        if (!byBase.has(base)) byBase.set(base, []);
        byBase.get(base).push(key);
    }
    return { keys, byBase };
}

function pickKey(index, label, { percent, bare, plus }) {
    const normalized = normalizeLabel(label);
    if (!normalized || SKIP_LABELS.has(normalized)) return null;
    if (index.keys.has(normalized)) return normalized;
    const candidates = index.byBase.get(normalized);
    if (!candidates || candidates.length === 0) return null;
    const rank = (key) => {
        const suffix = key.endsWith('_percent') ? 'percent' : key.endsWith('_base') ? 'base' : key.endsWith('_flat') ? 'flat' : 'none';
        if (suffix === 'percent') return percent ? 0 : 3;
        if (suffix === 'base') return bare && !percent && !plus ? 0 : 3;
        if (suffix === 'flat') return !percent && (plus || bare) ? 1 : 3;
        return 0;
    };
    return [...candidates].sort((a, b) => rank(a) - rank(b))[0];
}

// Parses a single lore line into { key, value } or null.
function parseStatLine(line, index) {
    const text = String(line.text || '').trim();
    if (!text || text.endsWith(':')) return null;
    if (text.includes(' : ')) return null; // region / rarity lines
    if (!/\d/.test(text)) return null;

    // Enchantment/curse with a trailing level: "Magic Protection IV", "Regeneration 3"
    const levelMatch = /^(.+?)\s+(X|IX|IV|V?I{0,3}|\d+)$/i.exec(text);
    if (levelMatch && !/\d/.test(levelMatch[1])) {
        const label = levelMatch[1].trim();
        const normalized = normalizeLabel(label);
        if (SKIP_LABELS.has(normalized)) return null;
        const roman = ROMAN[levelMatch[2].toLowerCase()];
        const value = roman || Number(levelMatch[2]);
        if (!Number.isFinite(value) || value <= 0) return null;
        if (index.keys.has(normalized)) return { key: normalized, value };
        // Unknown enchant names are allowed (new/unreleased items) as long as
        // the label isn't obviously item metadata.
        return { key: normalized, value };
    }

    // Attribute with a sign/percent: "+25% Spiritual Combos Damage"
    const attrMatch = /^([+-]?\d+(?:\.\d+)?)(%?)\s+(.+)$/.exec(text);
    if (attrMatch) {
        const value = Number(attrMatch[1]);
        if (!Number.isFinite(value) || value === 0) return null;
        const key = pickKey(index, attrMatch[3], {
            percent: attrMatch[2] === '%',
            bare: !attrMatch[1].startsWith('+') && !attrMatch[1].startsWith('-'),
            plus: attrMatch[1].startsWith('+'),
        });
        if (!key) return null;
        return { key, value };
    }

    return null;
}

// Curses without a level in the lore ("Curse of Corruption") are level 1, and
// enchantment lines can omit the level too ("Adaptability") when the level is 1.
function levelOneFallback(line, index) {
    const normalized = normalizeLabel(line.text);
    if (!normalized) return null;
    if (!index.keys.has(normalized)) return null;
    if (normalized.startsWith('curse_of_') || normalized.endsWith('_fragility')) {
        return { key: normalized, value: 1 };
    }
    // A bare enchantment name only counts when it has no numbers at all
    // (stat lines always carry a value).
    if (/\d/.test(line.text)) return null;
    return { key: normalized, value: 1 };
}

// lines: raw lore entries (JSON component strings / plain strings).
// enchants: optional { name: level } map from the item's Monumenta Stock NBT,
// which is the authoritative source for enchantment levels (they are not
// always rendered in display.Lore).
// Returns { stats, colors }.
export function mapLoreToStats(lines, index, { enchants } = {}) {
    const stats = {};
    const colors = {};
    for (const [name, level] of Object.entries(enchants || {})) {
        const key = normalizeLabel(name);
        const value = Number(level);
        if (!key || SKIP_ENCHANTS.has(key.replace(/_/g, '')) || !Number.isFinite(value) || value <= 0) continue;
        stats[key] = value;
    }
    for (const line of parseLoreLines(lines)) {
        const parsed = parseStatLine(line, index) || levelOneFallback(line, index);
        if (!parsed) continue;
        // First occurrence wins (Stock enchant levels are authoritative, so
        // lore lines never overwrite them).
        if (stats[parsed.key] === undefined) {
            stats[parsed.key] = convertValue(parsed.key, parsed.value, line.text);
            const hex = line.color;
            if (hex) colors[parsed.key] = hex;
        }
    }
    return { stats, colors };
}
