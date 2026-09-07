// Aligns itemsheet-map.json values with the actual class names emitted in
// _itemsheet.css. The sheet builder derives CSS rule names from texture file
// names (apostrophes stripped: "frost_giants_staff_0dda4511") while some map
// entries carry a name-derived token with a different slug for the same cell
// (apostrophe kept as separator: "frost_giant_s_staff_0dda4511"). Any such
// entry references a CSS rule that does not exist, so the tile renders with
// no background position (the sheet's first cell / nothing).
//
// The trailing 8-hex hash is stable per resolved texture entry, so the fix is
// simply: for each map value, swap in the CSS rule that ends with the same
// hash. Entries with no matching rule are reported (they still fall back to
// the minecraft texture at runtime).
//
// Run: node scripts/spritesheetmaker/fix-map-classes.js

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'public', 'spritesheets');
const CSS_PATH = path.join(OUTPUT_DIR, '_itemsheet.css');
const MAP_PATH = path.join(OUTPUT_DIR, 'itemsheet-map.json');

const css = fs.readFileSync(CSS_PATH, 'utf8');
const byHash = new Map();
for (const m of css.matchAll(/\.monumenta-([\w-]+)_([0-9a-f]{8}) \{\s*background-position:/g)) {
    const name = m[1];
    const hash = m[2];
    const full = `${name}_${hash}`;
    const existing = byHash.get(hash);
    if (!existing) byHash.set(hash, full);
}
// Prefer rules whose prefix is the plain token (no extra dashed suffix noise)
// when the same hash legitimately maps to several names.
for (const m of css.matchAll(/\.monumenta-([\w-]+)_([0-9a-f]{8}) \{/g)) {
    const full = `${m[1]}_${m[2]}`;
    const cur = byHash.get(m[2]);
    if (!cur || full.length < cur.length) byHash.set(m[2], full);
}

const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
let changed = 0;
let matched = 0;
let unmatched = [];
for (const [key, value] of Object.entries(map)) {
    if (typeof value !== 'string') continue;
    const hash = value.slice(-8);
    const cssClass = byHash.get(hash);
    if (cssClass && cssClass === value) {
        matched++;
        continue;
    }
    if (cssClass) {
        map[key] = cssClass;
        matched++;
        changed++;
    } else {
        unmatched.push({ key, value });
    }
}

fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
console.log(`Total map entries: ${Object.keys(map).length}`);
console.log(`Already matching css: ${matched - changed}`);
console.log(`Realigned: ${changed}`);
console.log(`Unmatched (no css rule for hash): ${unmatched.length}`);
for (const u of unmatched.slice(0, 10)) console.log('  -', u.key, '=>', u.value);
