// Minecraft profile lookups for linked-account display. The player's name and
// skin come from Mojang's session API (the same source NameMC's pages show);
// the rendered head is served by mc-heads.net, which renders Mojang skins by
// UUID. Lookups are cached in memory for an hour - the account page re-reads
// them on every visit.

const NAME_CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map(); // uuid (dashed, lowercase) -> { name, skinUrl, fetchedAt }

export function minecraftAvatarUrl(uuid) {
    return `https://mc-heads.net/avatar/${uuid}/64`;
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
