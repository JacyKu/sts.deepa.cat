import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeHistory } from './item-history.mjs';
import { updateClassData } from './class-history.mjs';
import {
    extractStatColors,
    extractLocationColor,
    extractLocationColorFromRegistry,
    extractEffectColors,
} from './stat-colors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(__dirname, '..', 'public', 'items', 'items.json');
const HISTORY_TARGET = path.join(__dirname, '..', 'public', 'items', 'item-history.json');
// Timestamped copies of the outgoing history are kept here before every
// rewrite, so an accidental loss (deleted file, bad write) can be recovered.
const BACKUPS_DIR = path.join(__dirname, '..', 'public', 'items', 'backups');
const HISTORY_BACKUPS_KEPT = 10;
const MIN_ITEMS = 1000;

async function backupHistoryFile() {
    try {
        const existing = await fs.readFile(HISTORY_TARGET, 'utf8');
        if (!existing.trim()) return;
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.writeFile(path.join(BACKUPS_DIR, `item-history-${stamp}.json`), existing);
        const backups = (await fs.readdir(BACKUPS_DIR))
            .filter((name) => name.startsWith('item-history-') && name.endsWith('.json'))
            .sort();
        for (const name of backups.slice(0, Math.max(0, backups.length - HISTORY_BACKUPS_KEPT))) {
            await fs.rm(path.join(BACKUPS_DIR, name), { force: true });
        }
    } catch (err) {
        // First run (no history yet) or unreadable file - nothing to back up.
    }
}

const sources = [
    {
        name: 'Monumenta API',
        // itemswithnbt is a superset of /items: same item fields plus the
        // in-game NBT, whose lore carries the exact color of every stat line.
        url: 'https://api.playmonumenta.com/itemswithnbt',
        headers: {},
    },
    {
        name: 'U5B GitHub',
        url: 'https://raw.githubusercontent.com/U5B/Monumenta/main/out/item.json',
        headers: {},
    },
];

const user = process.env.STS_MONUMENTA_USER;
const pass = process.env.STS_MONUMENTA_PASS;
if (user && pass) {
    sources[0].headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function fetchSource(source) {
    const res = await fetch(source.url, { headers: source.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw);

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('not a JSON object');
    }
    const keys = Object.keys(data);
    if (keys.length < MIN_ITEMS) {
        throw new Error(`only ${keys.length} entries (expected at least ${MIN_ITEMS})`);
    }
    const sample = data[keys[0]];
    if (!sample || typeof sample.name !== 'string' || typeof sample.stats !== 'object') {
        throw new Error('unexpected item shape (missing name/stats)');
    }

    return { data, keys, bytes: Buffer.byteLength(raw) };
}

// The /locations endpoint is the authoritative source for location colors:
// every item's locationId maps to a registry entry whose colour is exactly
// the one the game renders on the location line. Resolving colours from it
// keeps items coloured across display-name renames; the per-item NBT scan is
// only the fallback when locationId is absent (the U5B mirror) or unknown.
async function fetchLocationRegistry() {
    const res = await fetch('https://api.playmonumenta.com/locations');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const map = {};
    for (const location of data.locations || []) {
        if (location && typeof location.name === 'string' && /^#[0-9a-fA-F]{6}$/.test(location.color || '')) {
            map[location.name] = location.color.toUpperCase();
        }
    }
    if (Object.keys(map).length === 0) throw new Error('registry is empty');
    return map;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    const current = JSON.parse(await fs.readFile(TARGET, 'utf8'));
    const currentCount = Object.keys(current).length;

    let result = null;
    let lastError = null;
    for (const source of sources) {
        try {
            result = await fetchSource(source);
            console.log(`Fetched from ${source.name} (${source.url})`);
            break;
        } catch (err) {
            lastError = err;
            console.warn(`  ${source.name} failed: ${err.message}`);
        }
    }

    if (!result) {
        console.error(`\nFailed to fetch from all sources. Last error: ${lastError?.message}`);
        console.error('items.json left unchanged.');
        process.exit(1);
    }

    // The API classifies a few items in a way we want to override.
    const TYPE_OVERRIDES = {
        '3-D Glasses': 'Helmet',
    };
    for (const key of result.keys) {
        const name = result.data[key]?.name;
        if (name && TYPE_OVERRIDES[name]) {
            result.data[key].type = TYPE_OVERRIDES[name];
        }
    }

    // Pull the exact per-stat display colors out of the NBT lore and drop the
    // NBT itself (the site never consumes it). Items from sources without NBT
    // simply get no statColors and render with the site's fallback palette.
    // Location colors resolve from the /locations registry via each item's
    // locationId first, with the NBT location line as fallback;
    // `npm run check:data` fails when a location cannot be resolved to one, so
    // API renames cannot silently drop the colors again.
    let registryColors = null;
    try {
        registryColors = await fetchLocationRegistry();
        console.log(`Location registry: ${Object.keys(registryColors).length} locations`);
    } catch (err) {
        console.warn(`  location registry failed (${err.message}) - falling back to NBT colors`);
    }

    let coloredItems = 0;
    let coloredStats = 0;
    let coloredLocations = 0;
    let registryLocations = 0;
    let nbtLocations = 0;
    let effectItems = 0;
    let coloredEffects = 0;
    for (const key of result.keys) {
        const item = result.data[key];
        const colors = extractStatColors(item);
        if (colors) {
            item.statColors = colors;
            coloredItems++;
            coloredStats += Object.keys(colors).length;
        }
        const registryColor = extractLocationColorFromRegistry(item, registryColors);
        const locationColor = registryColor || extractLocationColor(item);
        if (locationColor) {
            item.locationColor = locationColor;
            coloredLocations++;
            if (registryColor) registryLocations++;
            else nbtLocations++;
        }
        if (Array.isArray(item.effects) && item.effects.length > 0) {
            effectItems++;
            const effectColors = extractEffectColors(item);
            if (effectColors) {
                item.effectColors = effectColors;
                coloredEffects++;
            }
        }
        delete item.nbt;
    }
    console.log(`stat colors: ${coloredItems} items, ${coloredStats} stat lines`);
    console.log(
        `location colors: ${coloredLocations} items (${registryLocations} via locationId, ${nbtLocations} via NBT)`
    );
    console.log(`effect colors: ${coloredEffects} of ${effectItems} effect items`);

    const removed = currentCount - result.keys.length;
    console.log(
        `\nitems.json: ${currentCount} -> ${result.keys.length} items (${removed >= 0 ? '-' : '+'}${Math.abs(removed)})`
    );
    console.log(`payload: ${(result.bytes / 1048576).toFixed(1)} MB raw`);

    if (dryRun) {
        console.log('\nDry run - not writing.');
        return;
    }

    // Archive every item whose data changed before overwriting: the old
    // version moves into item-history.json instead of being lost forever.
    let historyRaw = null;
    try {
        historyRaw = await fs.readFile(HISTORY_TARGET, 'utf8');
    } catch (err) {
        historyRaw = null; // first run - the archive file doesn't exist yet
    }
    const { raw: historyNext, summary } = mergeHistory(historyRaw, current, result.data);
    if (historyNext) {
        await backupHistoryFile();
        const tmpH = HISTORY_TARGET + '.tmp';
        await fs.writeFile(tmpH, historyNext);
        await fs.rename(tmpH, HISTORY_TARGET);
        console.log(
            `\nArchived stat history: ${summary.changed.length} changed, ${summary.removed.length} removed, ${summary.added.length} added`
        );
        for (const key of summary.changed.slice(0, 10)) console.log(`  changed: ${key}`);
        if (summary.removed.length) {
            for (const key of summary.removed.slice(0, 10)) console.log(`  removed: ${key}`);
        }
        if (summary.changed.length > 10) console.log(`  ... and ${summary.changed.length - 10} more`);
    } else {
        console.log('\nNo item stat changes detected - history left unchanged.');
    }

    const tmp = TARGET + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(result.data));
    await fs.rename(tmp, TARGET);
    console.log(`\nWrote ${path.relative(process.cwd(), TARGET)}`);

    // The weekly run also refreshes the class data so class changes are
    // archived without a separate trigger (the moderation page's Classes
    // panel / update:classes run the same update on demand).
    console.log('\nFetching class data...');
    try {
        await updateClassData({ log: console });
    } catch (err) {
        console.warn(`  class update failed (items still updated): ${err.message}`);
    }

    console.log('Restart the dev server (or wait for a reload) for the change to take effect.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
