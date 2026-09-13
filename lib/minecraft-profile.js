// Minecraft profile lookups for linked-account display. The player's name and
// skin come from Mojang's session API (the same source NameMC's pages show);
// the rendered head image is fetched once from mc-heads.net and then cached on
// the server (memory + data/avatars on disk) and served through
// /api/v1/minecraft-avatar/<uuid>, so pages never hotlink the external site.
//
// Name lookups are cached in memory for an hour - the account page re-reads
// them on every visit. Avatar images are cached for a day (stale copies are
// still served when mc-heads is unreachable).

import fs from 'node:fs';
import path from 'node:path';

const NAME_CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map(); // uuid (dashed, lowercase) -> { name, skinUrl, fetchedAt }

const AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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
    return clean ? `/api/v1/minecraft-avatar/${clean}` : null;
}

export function minecraftAvatarRemoteUrl(uuid) {
    const clean = normalizeUuid(uuid);
    return clean ? `https://mc-heads.net/avatar/${clean}/64` : null;
}

// The cached avatar image for a UUID: { buffer, contentType, fetchedAt }.
// Memory first, then disk, then mc-heads. A stale disk copy is served when
// the upstream fetch fails, so the icon does not disappear during outages.
export async function getMinecraftAvatar(uuid) {
    const clean = normalizeUuid(uuid);
    if (!clean) return null;
    const now = Date.now();

    const mem = avatarCache.get(clean);
    if (mem && now - mem.fetchedAt < AVATAR_CACHE_TTL_MS) return mem;

    const file = path.join(AVATAR_DIR, `${clean}.png`);
    let stale = null;
    try {
        const buffer = fs.readFileSync(file);
        const stat = fs.statSync(file);
        if (buffer.length > 0) {
            stale = { buffer, contentType: 'image/png', fetchedAt: stat.mtimeMs };
            if (now - stat.mtimeMs < AVATAR_CACHE_TTL_MS) {
                avatarCache.set(clean, stale);
                return stale;
            }
        }
    } catch (e) {
        // no cached copy yet
    }

    try {
        const res = await fetch(`https://mc-heads.net/avatar/${clean}/64`, {
            signal: AbortSignal.timeout(10_000),
            headers: { 'User-Agent': 'sts.deepa.cat' },
        });
        if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > 0) {
                const entry = {
                    buffer,
                    contentType: res.headers.get('content-type') || 'image/png',
                    fetchedAt: now,
                };
                try {
                    fs.mkdirSync(AVATAR_DIR, { recursive: true });
                    fs.writeFileSync(file, buffer);
                } catch (e) {
                    // Disk full / read-only: still serve from memory.
                }
                if (avatarCache.size > 2000) avatarCache.clear();
                avatarCache.set(clean, entry);
                return entry;
            }
        }
    } catch (e) {
        // offline / rate-limited
    }
    return stale;
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
