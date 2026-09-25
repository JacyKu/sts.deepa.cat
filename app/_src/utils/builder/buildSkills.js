import { decodeBuildParam } from './buildUrlCodec';

function safeDecodeComponent(value) {
    try {
        return decodeURIComponent(String(value || ''));
    } catch (e) {
        return '';
    }
}

// Reads the skill portion (class, spec, class/spec skill points,
// enhancements, CZ abilities) out of a build token, mirroring the builder's
// URL-load logic. Returns null when the token has no class part.
//
// Shared by the builder (copying skills from the caller's own builds, where
// the token is already at hand) and the public build skills endpoint (which
// decodes the stored token server-side so public builds never expose it).
export function skillsPayloadFromToken(token, itemData) {
    if (!token) return null;
    let decoded = null;
    try {
        decoded = decodeBuildParam(token, itemData);
    } catch (e) {
        return null;
    }
    if (!decoded) return null;
    let parts = [];
    try {
        parts = decodeURI(decoded).split('&');
    } catch (e) {
        return null;
    }
    const find = (key) => {
        const part = parts.find((p) => p.startsWith(`${key}=`));
        return part ? part.slice(key.length + 1) : null;
    };
    const rawClass = find('cl');
    if (!rawClass) return null;
    const parsePoints = (raw) => {
        const out = {};
        safeDecodeComponent(raw)
            .split(',')
            .forEach((entry) => {
                const [id, pts] = entry.split(':');
                const points = Number(pts);
                if (id && Number.isInteger(points) && points > 0) out[id] = points;
            });
        return out;
    };
    const parseSet = (raw) => {
        const out = {};
        safeDecodeComponent(raw)
            .split(',')
            .forEach((entry) => {
                if (entry) out[entry] = true;
            });
        return out;
    };
    const parseCz = (raw) => {
        const out = {};
        safeDecodeComponent(raw)
            .split(',')
            .forEach((entry) => {
                // Legacy "Name:rarity" suffixes are dropped - abilities are
                // always Twisted.
                const name = entry.split(':')[0];
                if (name) out[name] = true;
            });
        return out;
    };
    const rawSpec = find('sp');
    return {
        cl: rawClass.toLowerCase(),
        sp: rawSpec ? safeDecodeComponent(rawSpec) : null,
        sk: parsePoints(find('sk')),
        ssk: parsePoints(find('ssk')),
        en: parseSet(find('en')),
        cz: parseCz(find('cz')),
    };
}
