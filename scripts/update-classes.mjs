import { updateClassData } from './class-history.mjs';

// Fetches the class/skill/spec data from the Monumenta API (/skills), archives
// every difference into public/items/class-history.json and writes
// public/items/skills.json. The same run is available on the server through
// the moderation page's Classes panel (npm run update:classes locally).
//
//   node scripts/update-classes.mjs             # fetch, archive, write
//   node scripts/update-classes.mjs --dry-run   # fetch + diff only, no writes

const dryRun = process.argv.includes('--dry-run');

updateClassData({ dryRun }).then(
    (summary) => {
        if (summary.total === 0) console.log('No class changes detected.');
        else console.log(`Class update done (${summary.total} entr${summary.total === 1 ? 'y' : 'ies'} changed).`);
    },
    (err) => {
        console.error(err);
        process.exit(1);
    }
);
