// Builds app/_src/data/locations.json: location display name -> registry id.
//
// Item data carries `location` (the name shown in game, e.g. "Salazar's Folly")
// and, once the import provides it, `locationId` (the registry's `name`, e.g.
// "lime"). Most items have no locationId yet, so the site resolves the id from
// this map, which lets the "show location ids" setting work for every item.
//
//   node scripts/update-locations.mjs
//
// Network: api.playmonumenta.com (read-only, no key).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(__dirname, '..', 'app', '_src', 'data', 'locations.json');
const API = 'https://api.playmonumenta.com/locations';
const UA = 'sts.deepa.cat location map (+https://deepa.cat)';

// Hand-added entries (e.g. locations the registry does not list) survive a
// regeneration.
async function loadManual() {
    try {
        const existing = JSON.parse(await fs.readFile(TARGET, 'utf8'));
        return existing.manual && typeof existing.manual === 'object' ? existing.manual : {};
    } catch {
        return {};
    }
}

async function main() {
    const res = await fetch(API, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${API}`);
    const list = (await res.json()).locations || [];

    const byName = {};
    for (const loc of list) {
        if (!loc || !loc.displayName || !loc.name) continue;
        byName[loc.displayName] = loc.name;
    }
    // Sorted so the committed file has a stable, reviewable order.
    const ordered = {};
    for (const name of Object.keys(byName).sort((a, b) => a.localeCompare(b))) ordered[name] = byName[name];

    const out = {
        generatedAt: new Date().toISOString(),
        source: API,
        note: 'Derived by scripts/update-locations.mjs; location display name -> registry id. Add one-off entries under "manual" - they survive regeneration.',
        locations: ordered,
        manual: await loadManual(),
    };
    await fs.writeFile(TARGET, JSON.stringify(out, null, 2) + '\n');

    console.log(`registry entries: ${list.length} | written: ${Object.keys(ordered).length}`);
    for (const [name, id] of Object.entries(ordered).slice(0, 8)) console.log(`  ${name} -> ${id}`);
}

main().catch((err) => {
    console.error('location update failed:', err.message);
    process.exitCode = 1;
});
