// Minecraft profile lookups for linked-account display. The player's name and
// skin come from Mojang's session API (the same source NameMC's pages show);
// the rendered head image is fetched once from mc-heads.net, then stored in
// the site database (lib/avatar-cache.js, memory + SQLite) and served through
// /api/v2/minecraft-avatar/<uuid>. Pages never hotlink the external site, so
// the images load the same on every device: the upstream API is only consulted
// when the UUID has never been fetched before.
//
// Name lookups are cached in memory for an hour - the account page re-reads
// them on every visit.

import fs from 'node:fs';
import path from 'node:path';
import { getCachedMinecraftAvatar, saveMinecraftAvatar, deleteCachedMinecraftAvatar } from './avatar-cache.js';

const NAME_CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map(); // uuid (dashed, lowercase) -> { name, skinUrl, fetchedAt }

// Legacy on-disk avatar cache (data/avatars). Still read as a fallback so the
// copies written before the database cache existed keep working; they are
// migrated into the database on first use.
const AVATAR_DIR = path.join(process.cwd(), 'data', 'avatars');
const avatarCache = new Map(); // bare uuid -> { buffer, contentType, fetchedAt }

// Accepts dashed or bare UUIDs; returns the bare lowercase form, or null.
function normalizeUuid(uuid) {
    const clean = String(uuid || '')
        .replace(/-/g, '')
        .toLowerCase();
    return /^[0-9a-f]{32}$/.test(clean) ? clean : null;
}

export function minecraftAvatarUrl(uuid) {
    const clean = normalizeUuid(uuid);
    if (!clean) return null;
    // The cache row's fetch time versions the URL: a refreshed head (e.g.
    // after re-linking) becomes a new URL for browsers, so they do not keep
    // showing the old image from their own cache.
    const cached = getCachedMinecraftAvatar(clean);
    return `/api/v2/minecraft-avatar/${clean}${cached ? `?v=${cached.fetchedAt}` : ''}`;
}

// The cached avatar image for a UUID: { buffer, contentType, fetchedAt }.
// Memory first, then the database, then the legacy disk cache, and only then
// the upstream render API. A successful upstream fetch is stored in the
// database so later requests - from any device - never need the upstream
// again.
export async function getMinecraftAvatar(uuid) {
    const clean = normalizeUuid(uuid);
    if (!clean) return null;

    const mem = avatarCache.get(clean);
    if (mem) return mem;

    const stored = getCachedMinecraftAvatar(clean);
    if (stored) {
        rememberAvatar(clean, stored);
        return stored;
    }

    // Legacy disk copy from before the database cache: migrate and serve.
    try {
        const buffer = fs.readFileSync(path.join(AVATAR_DIR, `${clean}.png`));
        if (buffer.length > 0) {
            const entry = { buffer, contentType: 'image/png', fetchedAt: Date.now() };
            saveMinecraftAvatar(clean, buffer, entry.contentType);
            rememberAvatar(clean, entry);
            return entry;
        }
    } catch (e) {
        // no cached copy
    }

    return fetchAndStoreMinecraftAvatar(clean);
}

// Fetches a fresh render from the upstream API and stores it. Returns null
// when the upstream is unreachable (the route then reports a miss).
//
// The response is served back from *our* origin, so it must be a real raster
// image: trusting the upstream Content-Type (or caching, say, HTML with a
// spoofed header) would turn this route into a same-origin script host if the
// upstream or the TLS path to it were ever compromised.
function sniffImageType(buffer) {
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 6 && buffer.subarray(0, 6).toString('latin1') === 'GIF89a') {
        return 'image/gif';
    }
    return null;
}

async function fetchAndStoreMinecraftAvatar(clean) {
    try {
        const res = await fetch(`https://mc-heads.net/avatar/${clean}/64`, {
            signal: AbortSignal.timeout(10_000),
            headers: { 'User-Agent': 'sts.deepa.cat' },
        });
        if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const contentType = sniffImageType(buffer);
            if (buffer.length > 0 && contentType) {
                const entry = { buffer, contentType, fetchedAt: Date.now() };
                saveMinecraftAvatar(clean, buffer, entry.contentType);
                rememberAvatar(clean, entry);
                return entry;
            }
        }
    } catch (e) {
        // offline / rate-limited: without a cached copy there is nothing to
        // serve, and the route reports that instead of hotlinking upstream.
    }
    return null;
}

// Drops the cached head (memory, database and the legacy disk copy) and
// fetches a fresh render. Called when a link is confirmed: a (re-)linked
// account should show its current skin immediately instead of the copy
// cached for that UUID earlier.
export async function refreshMinecraftAvatar(uuid) {
    const clean = normalizeUuid(uuid);
    if (!clean) return null;
    avatarCache.delete(clean);
    deleteCachedMinecraftAvatar(clean);
    try {
        fs.rmSync(path.join(AVATAR_DIR, `${clean}.png`));
    } catch (e) {
        // no legacy copy
    }
    return fetchAndStoreMinecraftAvatar(clean);
}

function rememberAvatar(uuid, entry) {
    if (avatarCache.size > 2000) avatarCache.clear();
    avatarCache.set(uuid, entry);
}

// Resolves a Minecraft UUID to { name, skinUrl } via the Mojang session API.
// Returns null when the UUID is unknown or the lookup fails (the caller then
// falls back to showing the raw UUID).
export async function getMinecraftProfile(uuid) {
    if (!uuid) return null;
    const cached = cache.get(uuid);
    if (cached && Date.now() - cached.fetchedAt < NAME_CACHE_TTL_MS) {
        return cached;
    }

    let profile = null;
    try {
        const bare = uuid.replace(/-/g, '');
        const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${bare}`, {
            signal: AbortSignal.timeout(10_000),
            headers: { 'User-Agent': 'sts.deepa.cat' },
        });
        if (res.ok) {
            const data = await res.json();
            const name = typeof data.name === 'string' ? data.name : null;
            const textures = data.properties && data.properties.find((p) => p.name === 'textures');
            let skinUrl = null;
            if (textures && typeof textures.value === 'string') {
                try {
                    const decoded = JSON.parse(Buffer.from(textures.value, 'base64').toString('utf8'));
                    skinUrl =
                        decoded.textures && decoded.textures.SKIN && decoded.textures.SKIN.url
                            ? String(decoded.textures.SKIN.url)
                            : null;
                } catch (e) {
                    // malformed textures payload; name still usable
                }
            }
            if (name) profile = { name, skinUrl, fetchedAt: Date.now() };
        }
    } catch (e) {
        // offline / rate-limited: fall back to no profile
    }

    if (profile) {
        cache.set(uuid, profile);
    } else if (cache.size > 5000) {
        cache.clear(); // bounded: never grows unboundedly
    }
    return profile;
}
