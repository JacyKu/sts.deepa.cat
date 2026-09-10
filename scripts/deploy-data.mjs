// One-command data deploy: validates the local item/spritesheet data, packs
// it, copies it to the STS server over SSH and restarts the app.
//
// Usage (from apps/sts):
//   npm run deploy:data              # production (sts.deepa.cat)
//   npm run deploy:data:dev          # dev (dev.deepa.cat)
//   node scripts/deploy-data.mjs --target prod --host root@example.com
//   node scripts/deploy-data.mjs --dry-run
//
// The host is taken from --host, then STS_DEPLOY_HOST, then the local git
// config (set it once with: git config sts.deployHost root@<server>).
// Validation runs first: a broken/mixed data set is never uploaded.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateData } from './validate-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const TARGETS = {
    prod: { remotePath: '/root/deepa.cat/apps/sts', app: 'sts', label: 'production (sts.deepa.cat)' },
    dev: { remotePath: '/root/sts-dev', app: 'sts-dev', label: 'dev (dev.deepa.cat)' },
};

function argValue(name) {
    const idx = process.argv.indexOf(name);
    return idx !== -1 ? process.argv[idx + 1] : null;
}

function resolveHost() {
    if (argValue('--host')) return argValue('--host');
    if (process.env.STS_DEPLOY_HOST) return process.env.STS_DEPLOY_HOST;
    const git = spawnSync('git', ['config', '--get', 'sts.deployHost'], { encoding: 'utf8' });
    if (git.status === 0 && git.stdout.trim()) return git.stdout.trim();
    return null;
}

function run(command, args) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.error) {
        console.error(`[deploy:data] failed to run ${command}: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`[deploy:data] ${command} exited with code ${result.status}`);
        process.exit(1);
    }
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const targetName = argValue('--target') || 'prod';
    const target = TARGETS[targetName];
    if (!target) {
        console.error(`[deploy:data] unknown target "${targetName}" (use prod or dev)`);
        process.exit(1);
    }

    // 1. Refuse to deploy inconsistent data (the sliding-sprites class of bug).
    console.log('[deploy:data] validating local data...');
    const { problems, stats } = validateData(PUBLIC_DIR);
    if (problems.length > 0) {
        console.error(`[deploy:data] validation FAILED - ${problems.length} problem(s), nothing deployed:`);
        for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
        process.exit(1);
    }
    console.log(
        `[deploy:data] data OK (${stats.mapKeys} map keys, ${stats.animated} animated, ${stats.items} items)`
    );

    // 2. Pack the data directories (items + spritesheets only).
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tarName = `sts-data-${stamp}.tar`;
    const tarPath = path.join(os.tmpdir(), tarName);
    run('tar', ['-cf', tarPath, '-C', PUBLIC_DIR, 'items', 'spritesheets']);
    const sizeMb = (fs.statSync(tarPath).size / 1048576).toFixed(1);
    console.log(`[deploy:data] packed ${tarName} (${sizeMb} MB) -> ${target.label}`);

    if (dryRun) {
        fs.rmSync(tarPath, { force: true });
        console.log('[deploy:data] dry run - skipping upload and restart');
        return;
    }

    const host = resolveHost();
    if (!host) {
        fs.rmSync(tarPath, { force: true });
        console.error('[deploy:data] no server host configured. Either:');
        console.error('  git config sts.deployHost root@<your-server>   (once)');
        console.error('  or set STS_DEPLOY_HOST, or pass --host root@<server>');
        process.exit(1);
    }

    // 3. Upload and unpack on the server, then restart the app.
    run('scp', [tarPath, `${host}:/tmp/${tarName}`]);
    const remote = [
        'set -e',
        `tar -xf /tmp/${tarName} -C ${target.remotePath}/public`,
        `rm -f /tmp/${tarName}`,
        `pm2 restart ${target.app} --update-env`,
    ].join(' && ');
    run('ssh', [host, remote]);
    fs.rmSync(tarPath, { force: true });

    console.log(`[deploy:data] deployed to ${target.label} and restarted "${target.app}"`);
    if (targetName === 'prod') {
        console.log('[deploy:data] note: the server checkout is now dirty under public/ (data is deployed directly).');
    }
}

main();
