// Fetches the Celestial Zenith / Darkest Depths ability data from the
// Monumenta wiki (which mirrors the game's data) and writes it to
// public/items/czAbilities.json.
//
// Descriptions contain rarity-scaled values as #{Common|Uncommon|Rare|Epic|Legendary|Twisted}
// templates; the app always shows the last (Twisted) value — rarity is gone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL =
    'https://monumenta.wiki.gg/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=API%3Adepths%20skills';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'items', 'czAbilities.json');

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Twisted'];

const res = await fetch(API_URL, { headers: { 'User-Agent': 'sts-builder-dev/1.0' } });
if (!res.ok) throw new Error(`wiki fetch failed: ${res.status}`);
const json = await res.json();
const page = Object.values(json.query.pages)[0];
const raw = page.revisions[0].slots.main['*'];
const data = JSON.parse(raw);

const seenNames = new Set();
const trees = (data.trees || []).map((t) => ({
    tree: t.tree,
    description: String(t.description || ''),
    skills: (t.skills || []).map((s) => {
        if (seenNames.has(s.name)) throw new Error(`duplicate ability name: ${s.name}`);
        seenNames.add(s.name);
        return {
            name: s.name,
            trigger: String(s.trigger || ''),
            cooldowns: String(s.cooldowns || ''),
            depths_description: String(s.depths_description || ''),
            zenith_description: String(s.zenith_description || ''),
        };
    }),
}));

const out = { rarities: RARITIES, trees };
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

const skillCount = trees.reduce((sum, t) => sum + t.skills.length, 0);
console.log(`wrote ${OUT}\ntrees: ${trees.length} (${trees.map((t) => t.tree).join(', ')})\nabilities: ${skillCount}`);
