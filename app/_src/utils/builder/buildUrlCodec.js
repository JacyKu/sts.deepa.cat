import LZString from 'lz-string';

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

const LEGACY_COMPRESSED_PREFIX = 'z:';
const BINARY_V1_PREFIX = 'v1_';

// The build token generation this codec currently produces. Short links are
// versioned against this (/b/v6/<id>) so older decoder versions can be kept
// around and the link routing stays honest about what a token contains.
export const CURRENT_TOKEN_VERSION = 6;

// Reads the version byte out of a binary token (v1_<base64url>), or null for
// legacy formats. Used to version short links and to validate that a token
// matches the version its link claims.
export function getBuildTokenVersion(token) {
    if (typeof token !== 'string' || !token.startsWith(BINARY_V1_PREFIX)) return null;
    try {
        const bytes = fromBase64Url(token.slice(BINARY_V1_PREFIX.length));
        return bytes.length > 0 ? bytes[0] : null;
    } catch (e) {
        return null;
    }
}

function isLegacyBuildString(value) {
    // Current legacy format is a querystring-like payload containing keys like m=, o=, ...
    return typeof value === 'string' && value.includes('=') && value.includes('&');
}

function fnv1a32(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function writeVarint(num) {
    let n = num >>> 0;
    const bytes = [];
    while (n >= 0x80) {
        bytes.push((n & 0x7f) | 0x80);
        n >>>= 7;
    }
    bytes.push(n);
    return Uint8Array.from(bytes);
}

function readVarint(buf, offset) {
    let result = 0;
    let shift = 0;
    let pos = offset;
    while (pos < buf.length) {
        const b = buf[pos++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result >>> 0, offset: pos };
}

function concatBytes(...parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

function toBase64Url(bytes) {
    // Browser + Node compatible base64url
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    // eslint-disable-next-line no-undef
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
    const base64 = str
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(str.length / 4) * 4, '=');
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    // eslint-disable-next-line no-undef
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function getTextCodec() {
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    if (!encoder || !decoder) {
        throw new Error('TextEncoder/TextDecoder not available');
    }
    return { encoder, decoder };
}

function buildHashLookup(itemData) {
    const map = new Map();
    if (!itemData) return map;
    for (const key of Object.keys(itemData)) {
        const h = fnv1a32(key);
        if (!map.has(h)) map.set(h, key);
    }
    return map;
}

export function normalizeBuildParam(build) {
    if (!build) return null;
    return Array.isArray(build) ? build[0] : build;
}

export function decodeBuildName(build) {
    const normalized = normalizeBuildParam(build);
    if (!normalized) return null;

    // Legacy formats: try to read name=... from the string directly.
    if (isLegacyBuildString(normalized)) {
        const part = normalized.split('&').find((p) => p.startsWith('name='));
        return part ? decodeURIComponent(part.slice('name='.length)) : null;
    }

    if (normalized.startsWith(LEGACY_COMPRESSED_PREFIX)) {
        const payload = normalized.slice(LEGACY_COMPRESSED_PREFIX.length);
        const decompressed = decompressFromEncodedURIComponent(payload);
        if (!decompressed) return null;
        const part = decompressed.split('&').find((p) => p.startsWith('name='));
        return part ? decodeURIComponent(part.slice('name='.length)) : null;
    }

    if (normalized.startsWith(BINARY_V1_PREFIX)) {
        try {
            const { decoder } = getTextCodec();
            const bytes = fromBase64Url(normalized.slice(BINARY_V1_PREFIX.length));
            if (bytes.length < 1 + 6 * 4) return null;
            let offset = 1 + 6 * 4;
            const charmLen = readVarint(bytes, offset);
            offset = charmLen.offset + charmLen.value;
            const nameLen = readVarint(bytes, offset);
            offset = nameLen.offset;
            if (nameLen.value === 0) return null;
            const nameBytes = bytes.slice(offset, offset + nameLen.value);
            return decoder.decode(nameBytes);
        } catch (e) {
            return null;
        }
    }

    return null;
}

export function decodeBuildParam(build, itemData) {
    const normalized = normalizeBuildParam(build);
    if (!normalized) return null;

    // Already legacy.
    if (isLegacyBuildString(normalized)) {
        return normalized;
    }

    // Existing compressed legacy format.
    if (normalized.startsWith(LEGACY_COMPRESSED_PREFIX)) {
        const payload = normalized.slice(LEGACY_COMPRESSED_PREFIX.length);
        const decompressed = decompressFromEncodedURIComponent(payload);
        return decompressed || null;
    }

    // New compact binary format.
    if (normalized.startsWith(BINARY_V1_PREFIX)) {
        if (!itemData) return null;
        const lookup = buildHashLookup(itemData);
        const { decoder } = getTextCodec();
        const bytes = fromBase64Url(normalized.slice(BINARY_V1_PREFIX.length));
        if (bytes.length < 1 + 6 * 4) return null;

        const version = bytes[0];
        if (version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) return null;

        const readU32 = (off) =>
            (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;

        const hashes = [];
        for (let i = 0; i < 6; i++) {
            hashes.push(readU32(1 + i * 4));
        }

        let offset = 1 + 6 * 4;
        const charmLen = readVarint(bytes, offset);
        offset = charmLen.offset;
        const charm = charmLen.value ? decoder.decode(bytes.slice(offset, offset + charmLen.value)) : 'None';
        offset += charmLen.value;

        const nameLen = readVarint(bytes, offset);
        offset = nameLen.offset;
        const name = nameLen.value ? decoder.decode(bytes.slice(offset, offset + nameLen.value)) : null;
        offset += nameLen.value;

        const keys = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];
        let legacy = '';
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const h = hashes[i];
            const itemKey = h === 0 ? 'None' : lookup.get(h) || 'None';
            legacy += `${key[0]}=${encodeURIComponent(itemKey)}&`;
        }

        legacy += `charm=${encodeURIComponent(charm || 'None')}`;
        if (name) legacy += `&name=${encodeURIComponent(name)}`;

        // Class and skill points.
        if (offset < bytes.length) {
            const classLen = readVarint(bytes, offset);
            offset = classLen.offset;
            const gameClass = classLen.value ? decoder.decode(bytes.slice(offset, offset + classLen.value)) : '';
            offset += classLen.value;

            const skillEntries = [];
            if (offset < bytes.length) {
                const skillCount = readVarint(bytes, offset);
                offset = skillCount.offset;
                for (let i = 0; i < skillCount.value && offset + 1 <= bytes.length; i++) {
                    const idLen = readVarint(bytes, offset);
                    offset = idLen.offset;
                    if (offset + idLen.value > bytes.length) break;
                    const skillId = decoder.decode(bytes.slice(offset, offset + idLen.value));
                    offset += idLen.value;
                    const points = bytes[offset++];
                    if (points > 0) skillEntries.push(`${skillId}:${points}`);
                }
            }

            if (gameClass) legacy += `&cl=${encodeURIComponent(gameClass)}`;
            if (skillEntries.length > 0) legacy += `&sk=${skillEntries.join(',')}`;

            // Extra stat inputs. v6+ encodes health as a varint (no upper cap,
            // minimum 1); older tokens keep 7 single bytes (health 0-255).
            const STAT_KEYS = ['health', 'tenacity', 'vitality', 'vigor', 'focus', 'perspicacity', 'region'];
            const STAT_DEFAULTS = [100, 0, 0, 0, 0, 0, 3];
            if (version === 6) {
                if (offset + 6 <= bytes.length) {
                    const singleStats = [
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                        bytes[offset + 4],
                        bytes[offset + 5],
                    ];
                    offset += 6;
                    const health = readVarint(bytes, offset);
                    offset = health.offset;
                    const statVals = [Math.max(1, health.value || 100), ...singleStats];
                    for (let i = 0; i < 7; i++) {
                        if (statVals[i] !== STAT_DEFAULTS[i]) legacy += `&${STAT_KEYS[i]}=${statVals[i]}`;
                    }
                }
            } else if (offset + 7 <= bytes.length) {
                for (let i = 0; i < 7; i++) {
                    const v = bytes[offset++];
                    if (v !== STAT_DEFAULTS[i]) legacy += `&${STAT_KEYS[i]}=${v}`;
                }
            }

            // v3 extras: spec, spec skill points, and enhancements.
            // Appended after the stat bytes when present; old tokens simply end here.
            if (offset < bytes.length) {
                const specLen = readVarint(bytes, offset);
                offset = specLen.offset;
                const specName = specLen.value ? decoder.decode(bytes.slice(offset, offset + specLen.value)) : '';
                offset += specLen.value;
                if (specName) legacy += `&sp=${encodeURIComponent(specName)}`;

                const specSkillCount = readVarint(bytes, offset);
                offset = specSkillCount.offset;
                const specSkillEntries = [];
                for (let i = 0; i < specSkillCount.value && offset + 1 <= bytes.length; i++) {
                    const idLen = readVarint(bytes, offset);
                    offset = idLen.offset;
                    if (offset + idLen.value > bytes.length) break;
                    const skillId = decoder.decode(bytes.slice(offset, offset + idLen.value));
                    offset += idLen.value;
                    const points = bytes[offset++];
                    if (points > 0) specSkillEntries.push(`${skillId}:${points}`);
                }
                if (specSkillEntries.length > 0) legacy += `&ssk=${specSkillEntries.join(',')}`;

                if (offset < bytes.length) {
                    const enCount = readVarint(bytes, offset);
                    offset = enCount.offset;
                    const enKeys = [];
                    for (let i = 0; i < enCount.value && offset < bytes.length; i++) {
                        const keyLen = readVarint(bytes, offset);
                        offset = keyLen.offset;
                        if (offset + keyLen.value > bytes.length) break;
                        enKeys.push(decoder.decode(bytes.slice(offset, offset + keyLen.value)));
                        offset += keyLen.value;
                    }
                    if (enKeys.length > 0) legacy += `&en=${enKeys.join(',')}`;
                }

                // v4 extras: Celestial Zenith / Depths abilities. The rarity
                // byte is read for format compatibility only - rarity is
                // always Twisted now, so it is never emitted.
                if (offset < bytes.length) {
                    const czCount = readVarint(bytes, offset);
                    offset = czCount.offset;
                    const czEntries = [];
                    for (let i = 0; i < czCount.value && offset + 1 <= bytes.length; i++) {
                        const nameLen = readVarint(bytes, offset);
                        offset = nameLen.offset;
                        if (offset + nameLen.value > bytes.length) break;
                        const abilityName = decoder.decode(bytes.slice(offset, offset + nameLen.value));
                        offset += nameLen.value;
                        offset += 1; // rarity byte (always Twisted)
                        czEntries.push(abilityName);
                    }
                    if (czEntries.length > 0) legacy += `&cz=${encodeURIComponent(czEntries.join(','))}`;

                    // v5 extras: Celestial Zenith ascension level (0-18).
                    if (version === 5 && offset < bytes.length) {
                        const ascension = bytes[offset++];
                        if (ascension > 0) legacy += `&asc=${ascension}`;
                    }
                }
            }
        }

        return legacy;
    }

    // Unknown token; treat as legacy-ish (best effort).
    return normalized;
}

export function encodeBuildParamLegacyCompressed(legacyBuildString) {
    if (!legacyBuildString) return null;
    return LEGACY_COMPRESSED_PREFIX + compressToEncodedURIComponent(legacyBuildString);
}

export function encodeBuildParam(legacyBuildString) {
    if (!legacyBuildString) return null;

    // If we were already given an encoded token, pass it through.
    if (typeof legacyBuildString === 'string') {
        if (legacyBuildString.startsWith(BINARY_V1_PREFIX) || legacyBuildString.startsWith(LEGACY_COMPRESSED_PREFIX)) {
            return legacyBuildString;
        }
    }

    // Prefer the compact binary token. If anything fails (older browser, etc), fall back to legacy compression.
    try {
        const params = new URLSearchParams(legacyBuildString);
        const itemKeys = [
            params.get('m') || 'None',
            params.get('o') || 'None',
            params.get('h') || 'None',
            params.get('c') || 'None',
            params.get('l') || 'None',
            params.get('b') || 'None',
        ];
        const charm = params.get('charm') || 'None';
        const name = params.get('name') || null;
        const gameClass = params.get('cl') || null;
        const spec = params.get('sp') || null;
        const skills = [];
        const skRaw = params.get('sk');
        if (skRaw) {
            for (const part of skRaw.split(',')) {
                const [id, pts] = part.split(':');
                const points = Number(pts);
                if (id && Number.isInteger(points) && points > 0) {
                    skills.push({ id, points });
                }
            }
        }
        const specSkills = [];
        const sskRaw = params.get('ssk');
        if (sskRaw) {
            for (const part of sskRaw.split(',')) {
                const [id, pts] = part.split(':');
                const points = Number(pts);
                if (id && Number.isInteger(points) && points > 0) {
                    specSkills.push({ id, points });
                }
            }
        }
        const enhancements = [];
        const enRaw = params.get('en');
        if (enRaw) {
            for (const key of enRaw.split(',')) {
                if (key) enhancements.push(key);
            }
        }
        // Celestial Zenith / Depths abilities: names only (legacy
        // "Name:rarity" suffixes are accepted and the rarity dropped -
        // everything is always Twisted).
        const czAbilities = [];
        const czRaw = params.get('cz');
        if (czRaw) {
            for (const part of czRaw.split(',')) {
                const name = part.split(':')[0];
                if (name) czAbilities.push({ name });
            }
        }
        // Celestial Zenith ascension level (0-18).
        const ascRaw = params.get('asc');
        const ascension = ascRaw === null ? 0 : Number(ascRaw);
        const ascensionValue = Number.isInteger(ascension) && ascension >= 0 && ascension <= 18 ? ascension : 0;
        // Extra stat inputs (health/tenacity/vitality/vigor/focus/perspicacity/region).
        const STAT_KEYS = ['health', 'tenacity', 'vitality', 'vigor', 'focus', 'perspicacity', 'region'];
        const STAT_DEFAULTS = [100, 0, 0, 0, 0, 0, 3];
        const statValues = STAT_KEYS.map((k, i) => {
            const v = params.get(k);
            if (v === null || v === '') return STAT_DEFAULTS[i];
            const n = Number(v);
            return Number.isFinite(n) ? n : STAT_DEFAULTS[i];
        });
        return encodeBuildParamBinaryV2({
            itemKeys,
            charm,
            name,
            gameClass,
            spec,
            skills,
            specSkills,
            enhancements,
            czAbilities,
            ascension: ascensionValue,
            statValues,
        });
    } catch (e) {
        return encodeBuildParamLegacyCompressed(legacyBuildString);
    }
}

export function encodeBuildParamBinaryV2({
    itemKeys,
    charm,
    name,
    gameClass,
    spec,
    skills,
    specSkills,
    enhancements,
    czAbilities,
    ascension,
    statValues,
}) {
    const { encoder } = getTextCodec();
    const keys = itemKeys || [];
    const hashes = new Uint8Array(6 * 4);

    for (let i = 0; i < 6; i++) {
        const value = keys[i];
        const h = !value || value === 'None' ? 0 : fnv1a32(String(value));
        hashes[i * 4] = h & 0xff;
        hashes[i * 4 + 1] = (h >>> 8) & 0xff;
        hashes[i * 4 + 2] = (h >>> 16) & 0xff;
        hashes[i * 4 + 3] = (h >>> 24) & 0xff;
    }

    const charmStr = charm && charm !== 'None' ? String(charm) : '';
    const charmBytes = charmStr ? encoder.encode(charmStr) : new Uint8Array(0);
    const charmLen = writeVarint(charmBytes.length);

    const nameStr = name ? String(name) : '';
    const nameBytes = nameStr ? encoder.encode(nameStr) : new Uint8Array(0);
    const nameLen = writeVarint(nameBytes.length);

    const classStr = gameClass ? String(gameClass) : '';
    const classBytes = classStr ? encoder.encode(classStr) : new Uint8Array(0);
    const classLen = writeVarint(classBytes.length);

    const skillParts = [];
    for (const skill of skills || []) {
        const idBytes = encoder.encode(String(skill.id));
        skillParts.push(
            writeVarint(idBytes.length),
            idBytes,
            Uint8Array.from([Math.max(0, Math.min(255, Number(skill.points) || 0))])
        );
    }
    const skillCount = writeVarint(skillParts.length / 3);

    // Extra stat inputs. Health is a varint in v6+ (no upper cap, minimum 1);
    // the remaining stats stay single bytes.
    const statBytes = Uint8Array.from(
        [0, 0, 0, 0, 0, 3].map((d, i) => {
            const v = Number(statValues && statValues[i + 1]);
            const n = Number.isFinite(v) ? v : d;
            return Math.max(0, Math.min(255, Math.round(n)));
        })
    );
    const healthRaw = Number(statValues && statValues[0]);
    const health = Number.isFinite(healthRaw) ? Math.max(1, Math.round(healthRaw)) : 100;
    const healthBytes = writeVarint(health);

    // v3 extras: spec, spec skill points, and enhancements.
    const specStr = spec ? String(spec) : '';
    const specBytes = specStr ? encoder.encode(specStr) : new Uint8Array(0);
    const specLen = writeVarint(specBytes.length);

    const specSkillParts = [];
    for (const skill of specSkills || []) {
        const idBytes = encoder.encode(String(skill.id));
        specSkillParts.push(
            writeVarint(idBytes.length),
            idBytes,
            Uint8Array.from([Math.max(0, Math.min(255, Number(skill.points) || 0))])
        );
    }
    const specSkillCount = writeVarint(specSkillParts.length / 3);

    const enParts = [];
    for (const key of enhancements || []) {
        const keyBytes = encoder.encode(String(key));
        enParts.push(writeVarint(keyBytes.length), keyBytes);
    }
    const enCount = writeVarint(enParts.length / 2);

    const czParts = [];
    for (const ability of czAbilities || []) {
        const nameBytes = encoder.encode(String(ability.name));
        // Rarity is always Twisted (5); kept as a byte for format compatibility.
        czParts.push(writeVarint(nameBytes.length), nameBytes, Uint8Array.from([5]));
    }
    const czCount = writeVarint(czParts.length / 3);

    const version = Uint8Array.from([6]);
    const packed = concatBytes(
        version,
        hashes,
        charmLen,
        charmBytes,
        nameLen,
        nameBytes,
        classLen,
        classBytes,
        skillCount,
        ...skillParts,
        statBytes,
        healthBytes,
        specLen,
        specBytes,
        specSkillCount,
        ...specSkillParts,
        enCount,
        ...enParts,
        czCount,
        ...czParts
    );
    return BINARY_V1_PREFIX + toBase64Url(packed);
}
