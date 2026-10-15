// Builds public/items/quests.json: quest-code -> quest-name, scraped from the
// Monumenta wiki.
//
// Item lore tags quest items with a "#Q<id>" code, but nothing publishes what
// each code is called. The wiki has no such mapping either, so it is derived:
// the Quests page lists every quest (and its rewards), each quest has a page,
// and a quest page usually names the items its quest uses. A code is only
// accepted when the quest page mentions at least MIN_ITEM_MATCHES of that
// code's items - one hit could be a coincidence, two is a confirmation.
//
// Quests that cannot be confirmed are simply left out; they can be filled in by
// hand in the "manual" section, which this script preserves across runs.
//
//   node scripts/update-quests.mjs
//
// Network: monumenta.wiki.gg (read-only, no key).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ITEMS_PATH = path.join(__dirname, '..', 'public', 'items', 'items.json');
// Bundled with the client (like data/skins.json): small, changes rarely, and
// hand-editable afterwards.
const TARGET = path.join(__dirname, '..', 'app', '_src', 'data', 'quests.json');

const API = 'https://monumenta.wiki.gg/api.php';
const UA = 'sts.deepa.cat quest map (+https://deepa.cat)';
const BATCH = 40;
// Minimum number of a code's item names that must appear on the quest page
// before the code is accepted. 2 avoids single-mention coincidences.
const MIN_ITEM_MATCHES = 2;
// Very short names match too much text to be evidence.
const MIN_NAME_LEN = 5;

// Same extraction the items page uses, so codes line up exactly.
const QUEST_ID_RE = /#Q([A-Za-z0-9]+?)(?:I\d+)?(?![A-Za-z0-9])/g;

async function getJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
}

// "Name (variant)" is a site display suffix, not part of the item's name.
function baseName(name) {
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function normalize(text) {
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ');
}

// Every quest name the Quests page lists, in its rendered tables.
async function fetchQuestNames() {
    const url = `${API}?action=parse&page=Quests&prop=text&format=json&formatversion=2`;
    const html = (await getJson(url)).parse.text;
    const names = new Set();
    for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
        const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]);
        if (cells.length < 3) continue;
        const links = [...cells[0].matchAll(/title="([^"]+)"/g)]
            .map((m) => m[1])
            .filter((t) => !t.startsWith('File:') && !t.endsWith('(page does not exist)'));
        if (links.length > 0) names.add(links[0]);
    }
    return [...names];
}

// code -> set of item names carrying it.
function codedItems(items) {
    const codes = new Map();
    for (const [name, item] of Object.entries(items)) {
        const text = `${(item.mmlore || []).join('\n')}\n${item.lore || ''}`;
        if (!text.includes('* Quest Item *')) continue;
        const clean = text.replace(/<[^>]+>/g, '');
        QUEST_ID_RE.lastIndex = 0;
        const ids = new Set();
        let match;
        while ((match = QUEST_ID_RE.exec(clean))) ids.add(match[1]);
        for (const id of ids) {
            if (!codes.has(id)) codes.set(id, new Set());
            codes.get(id).add(baseName(name));
        }
    }
    return codes;
}

async function fetchPageTexts(titles) {
    const pages = new Map();
    for (let i = 0; i < titles.length; i += BATCH) {
        const batch = titles.slice(i, i + BATCH);
        const url = `${API}?action=query&format=json&formatversion=2&prop=revisions&rvslots=main&rvprop=content&titles=${encodeURIComponent(batch.join('|'))}`;
        const data = await getJson(url);
        for (const page of data.query?.pages || []) {
            if (page.missing) continue;
            const content = page.revisions?.[0]?.slots?.main?.content;
            if (content) pages.set(normalize(page.title), normalize(content));
        }
    }
    return pages;
}

async function loadManual() {
    try {
        const existing = JSON.parse(await fs.readFile(TARGET, 'utf8'));
        return existing.manual && typeof existing.manual === 'object' ? existing.manual : {};
    } catch {
        return {};
    }
}

async function main() {
    const items = JSON.parse(await fs.readFile(ITEMS_PATH, 'utf8'));
    const codes = codedItems(items);
    const names = await fetchQuestNames();
    console.log(`quests on the wiki: ${names.length} | quest codes in item lore: ${codes.size}`);

    const pages = await fetchPageTexts(names);
    console.log(`quest pages fetched: ${pages.size}`);

    // Item names worth matching on, compiled once.
    const matchers = new Map();
    for (const itemset of codes.values()) {
        for (const name of itemset) {
            if (name.length < MIN_NAME_LEN || matchers.has(name)) continue;
            const body = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s_]+');
            matchers.set(name, new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, 'i'));
        }
    }

    // quest name -> the item names it mentions.
    const questHits = new Map();
    for (const [quest, text] of pages) {
        const hits = [];
        for (const [name, re] of matchers) if (re.test(text)) hits.push(name);
        questHits.set(quest, new Set(hits));
    }

    const confirmed = {};
    let ties = 0;
    let unconfirmed = 0;
    for (const [code, itemNames] of [...codes].sort((a, b) => a[0].localeCompare(b[0]))) {
        const scores = new Map();
        for (const [quest, hits] of questHits) {
            const n = [...itemNames].filter((name) => hits.has(name)).length;
            if (n > 0) scores.set(quest, n);
        }
        if (scores.size === 0) {
            unconfirmed++;
            continue;
        }
        const best = Math.max(...scores.values());
        const winners = [...scores].filter(([, n]) => n === best).map(([quest]) => quest);
        if (best < MIN_ITEM_MATCHES || winners.length !== 1) {
            if (winners.length !== 1 && best >= MIN_ITEM_MATCHES) ties++;
            unconfirmed++;
            continue;
        }
        confirmed[code] = { name: winners[0], matches: best, items: itemNames.size };
    }

    const manual = await loadManual();
    // An array, not an object: JS reorders integer-like keys ("16", "21") ahead
    // of the rest ("01"), so an object could not keep a stable, reviewable order.
    const ordered = Object.entries(confirmed)
        .map(([code, info]) => ({ code, ...info }))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const out = {
        generatedAt: new Date().toISOString(),
        source: 'https://monumenta.wiki.gg/wiki/Quests',
        note: 'Derived by scripts/update-quests.mjs; a code is only listed when the wiki quest page names at least 2 of its items. Add one-off entries under "manual" - they survive regeneration.',
        minimumMatches: MIN_ITEM_MATCHES,
        quests: ordered,
        manual,
    };
    await fs.writeFile(TARGET, JSON.stringify(out, null, 2) + '\n');

    console.log(`confirmed ${ordered.length} codes (ties: ${ties}, unconfirmed/unknown: ${unconfirmed})`);
    console.log(`wrote ${path.relative(path.join(__dirname, '..'), TARGET)}`);
    for (const { code, name, matches, items } of ordered.slice(0, 8)) {
        console.log(`  Q${code} -> ${name} (${matches}/${items} items)`);
    }
}

main().catch((err) => {
    console.error('quest update failed:', err.message);
    process.exitCode = 1;
});
