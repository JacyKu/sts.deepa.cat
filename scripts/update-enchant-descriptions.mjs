import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANG_DIR = path.join(__dirname, '..', 'app', '_src', 'utils', 'translation', 'languages');
const EN_PATH = path.join(LANG_DIR, 'en.json');
const RAW_TARGET = path.join(__dirname, '..', 'public', 'items', 'enchantmentsData.json');

const ADVANCEMENT_SOURCES = ['https://raw.githubusercontent.com/U5B/Monumenta/main/out/advancement.json'];

// Handbook ids that don't match the stat key after normalization.
const ID_ALIASES = {
    veil: 'curse_of_the_veil',
};

// Handbook section headers / non-enchant entries to skip.
const SKIP_IDS = new Set([
    'root',
    'defenses',
    'weapons',
    'ranged',
    'tools',
    'passiveeffects',
    'consumables',
    'curses',
    'cosmetic',
    'event',
    'infusions',
    'delve_infusions',
]);

function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function statCandidates(statKey) {
    const candidates = [statKey];
    if (statKey.startsWith('curse_of_')) {
        candidates.push(statKey.slice('curse_of_'.length));
    }
    return candidates;
}

function formatTitle(str) {
    if (!str) return '';
    if (str.toLowerCase().includes('infinity')) return 'infinity';
    if (str.startsWith('curse_of')) {
        str = str.slice('curse_of'.length);
    }
    return str
        .replaceAll('jungle_s', 'jungles')
        .replaceAll('_', ' ')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/[\s+-]/g, '');
}

function extractDescription(display) {
    if (!display || !display.description) return '';
    const desc = display.description;
    const parts = Array.isArray(desc) ? desc : [desc];
    return parts
        .map((p) => (typeof p === 'string' ? p : (p.text ?? '')))
        .join('')
        .trim();
}

async function fetchAdvancements() {
    let lastError = null;
    for (const url of ADVANCEMENT_SOURCES) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (typeof data !== 'object' || data === null) throw new Error('not a JSON object');
            return data;
        } catch (err) {
            lastError = err;
            console.warn(`  ${url} failed: ${err.message}`);
        }
    }
    throw new Error(`failed to fetch advancements: ${lastError?.message}`);
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    console.log('Fetching advancement data...');
    const data = await fetchAdvancements();

    // Map normalized handbook id -> game description.
    const handbook = new Map();
    for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith('monumenta:handbook/enchantments/')) continue;
        const id = key.slice('monumenta:handbook/enchantments/'.length);
        if (SKIP_IDS.has(id)) continue;
        const description = extractDescription(value.display);
        if (!description) continue;
        handbook.set(normalize(id), { id, description });
    }
    console.log(`Handbook descriptions: ${handbook.size}`);

    const en = JSON.parse(await fs.readFile(EN_PATH, 'utf8'));
    const enchKeys = Object.keys(en).filter((k) => k.startsWith('items.enchant.'));

    const statsSeen = new Set();
    let matched = 0;
    let added = 0;
    let replaced = 0;

    const keyFor = (statKey) => `items.enchant.${formatTitle(statKey)}`;

    for (const entry of enchKeys) {
        const rawName = entry.slice('items.enchant.'.length);
        // Find the stat key this catalog key was generated from (best effort):
        // check every handbook id against the catalog key name.
        for (const [normId, hb] of handbook) {
            if (statsSeen.has(hb.id)) continue;
            const candidateKeys = [...statCandidates(hb.id)].concat(ID_ALIASES[hb.id] ?? []);
            const matches = candidateKeys.some((k) => keyFor(k) === entry || formatTitle(k) === rawName);
            if (matches) {
                statsSeen.add(hb.id);
                if (en[entry] !== hb.description) {
                    en[entry] = hb.description;
                    replaced++;
                }
                matched++;
                break;
            }
        }
    }

    // Add handbook entries that have no catalog key yet.
    for (const [normId, hb] of handbook) {
        if (statsSeen.has(hb.id)) continue;
        const statKey = ID_ALIASES[hb.id] ?? hb.id;
        const key = keyFor(statKey);
        if (!en[key]) {
            en[key] = hb.description;
            added++;
        }
    }

    console.log(`en.json: ${replaced} replaced, ${added} added, ${matched} matched total`);

    if (dryRun) {
        console.log('\nDry run - not writing.');
        return;
    }

    await fs.writeFile(EN_PATH, JSON.stringify(en, null, 4) + '\n');
    console.log(`Wrote ${path.relative(process.cwd(), EN_PATH)} (${Object.keys(en).length} keys)`);

    const raw = Object.fromEntries([...handbook.values()].map((hb) => [hb.id, hb.description]));
    await fs.writeFile(RAW_TARGET, JSON.stringify(raw, null, 4) + '\n');
    console.log(`Wrote ${path.relative(process.cwd(), RAW_TARGET)} (${handbook.size} entries)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
