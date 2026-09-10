import fs from 'node:fs/promises';
import os from 'node:os';
import { AwsClient } from 'aws4fetch';

// Cloudflare R2 offsite storage for database backups, via the S3-compatible
// API. Everything is optional: when the R2_* variables are missing the
// helpers report "not configured" and the local backup path still works.
//
//   R2_ACCOUNT_ID          Cloudflare account id (or set R2_ENDPOINT)
//   R2_ENDPOINT            optional full endpoint override
//   R2_ACCESS_KEY_ID       R2 API token access key
//   R2_SECRET_ACCESS_KEY   R2 API token secret
//   R2_BUCKET              bucket name
//   R2_PREFIX              key prefix (default "sts-builds/")

let cachedConfig;
let cachedConfigKey;

// Default key prefix, scoped per instance so production, dev and a local test
// can share a bucket without any one of them pruning the others' backups.
// Uses the public host when configured, otherwise the machine hostname:
//   sts-builds/backups/<host>/sts-builds-YYYYMMDD-HHMMSS.db
function defaultPrefix() {
    const base = process.env.STS_PUBLIC_BASE_URL;
    if (base) {
        try {
            const host = new URL(base).hostname.replace(/[^a-zA-Z0-9.-]/g, '');
            if (host) return `sts-builds/backups/${host}/`;
        } catch (error) {
            // fall through to the machine hostname
        }
    }
    const machine = os.hostname().replace(/[^a-zA-Z0-9.-]/g, '');
    return machine ? `sts-builds/backups/${machine}/` : 'sts-builds/backups/';
}

function readConfig() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint = (process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).replace(/\/+$/, '');
    const bucket = process.env.R2_BUCKET;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const prefix = process.env.R2_PREFIX || defaultPrefix();

    // Cache by the raw env values so a changed .env (pm2 restart --update-env)
    // is picked up without a process restart dance.
    const key = [endpoint, bucket, accessKeyId, secretAccessKey, prefix].join('\u0000');
    if (cachedConfigKey === key) return cachedConfig;

    cachedConfigKey = key;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
        cachedConfig = null;
    } else {
        cachedConfig = {
            endpoint,
            bucket,
            prefix,
            client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
        };
    }
    return cachedConfig;
}

export function isR2Configured() {
    return readConfig() !== null;
}

export function describeR2Target() {
    const config = readConfig();
    if (!config) return null;
    return `${config.bucket}/${config.prefix}`;
}

function objectUrl(config, key) {
    return `${config.endpoint}/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function readError(response) {
    const text = await response.text().catch(() => '');
    return `${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ''}`;
}

function decodeXml(value) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

// Upload one backup file. Returns the object key, or null when R2 is not
// configured. Throws on a failed request so callers can decide how loud to be.
export async function uploadR2Backup(file, name) {
    const config = readConfig();
    if (!config) return null;
    const key = config.prefix + name;
    const body = await fs.readFile(file);
    const response = await config.client.fetch(objectUrl(config, key), {
        method: 'PUT',
        body,
        headers: { 'content-type': 'application/octet-stream' },
    });
    if (!response.ok) throw new Error(`R2 upload failed: ${await readError(response)}`);
    return key;
}

// List every object under the configured prefix. Returns
// [{ key, name, size, lastModified }].
export async function listR2Backups() {
    const config = readConfig();
    if (!config) return [];
    const results = [];
    let continuationToken;
    do {
        const url = new URL(`${config.endpoint}/${config.bucket}`);
        url.searchParams.set('list-type', '2');
        url.searchParams.set('prefix', config.prefix);
        url.searchParams.set('max-keys', '1000');
        if (continuationToken) url.searchParams.set('continuation-token', continuationToken);

        const response = await config.client.fetch(url.toString(), { method: 'GET' });
        if (!response.ok) throw new Error(`R2 list failed: ${await readError(response)}`);
        const xml = await response.text();

        for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
            const block = match[1];
            const rawKey = /<Key>([\s\S]*?)<\/Key>/.exec(block);
            if (!rawKey) continue;
            const key = decodeXml(rawKey[1]);
            const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] || 0);
            const modified = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)?.[1];
            results.push({
                key,
                name: key.startsWith(config.prefix) ? key.slice(config.prefix.length) : key,
                size,
                lastModified: modified ? new Date(modified) : null,
            });
        }
        continuationToken = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
    } while (continuationToken);
    return results;
}

export async function downloadR2Backup(name, destination) {
    const config = readConfig();
    if (!config) throw new Error('R2 is not configured');
    const response = await config.client.fetch(objectUrl(config, config.prefix + name), { method: 'GET' });
    if (!response.ok) throw new Error(`R2 download failed: ${await readError(response)}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destination, buffer);
    return destination;
}

export async function deleteR2Backup(nameOrKey) {
    const config = readConfig();
    if (!config) return false;
    const key = nameOrKey.startsWith(config.prefix) ? nameOrKey : config.prefix + nameOrKey;
    const response = await config.client.fetch(objectUrl(config, key), { method: 'DELETE' });
    // S3 DELETE is idempotent; a missing object still returns 204.
    if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed: ${await readError(response)}`);
    return true;
}
