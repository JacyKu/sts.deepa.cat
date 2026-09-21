// Validation for client-supplied build tokens.
//
// The codec accepts three token shapes: plain legacy querystrings
// (`m=...&charm=...`), compressed legacy (`z:...`), and the binary format
// (`v1_...`). Only the binary format constrains what can be put in it, and
// even that carries free-form class/spec/skill/charm/stat strings, so a
// hand-crafted token can smuggle unknown items, malformed charm names (which
// crash the builder), wild stat values, or unbounded names into the database.
//
// Storage path: legacy tokens are rewritten to their sanitized form (unknown
// values are dropped, the token keeps working); binary tokens are only kept
// when they already round-trip unchanged, otherwise the save is rejected -
// those are only ever minted by our own encoders, so a mismatch means tampering.
//
// Display path: stored rows may already contain junk, so the same sanitizer
// runs when a build is opened and the builder receives the sanitized token.
import { decodeBuildParam } from './buildUrlCodec';
import czAbilitiesData from '../../../../public/items/czAbilities.json';

const BINARY_PREFIX = 'v1_';

const ITEM_SHORT_KEYS = ['m', 'o', 'h', 'c', 'l', 'b'];

// Same order and defaults as the binary decoder, so a clean binary token
// rebuilds byte-for-byte and can be compared directly.
const STAT_KEYS = ['health', 'tenacity', 'vitality', 'vigor', 'focus', 'perspicacity', 'region'];
const STAT_DEFAULTS = { health: 100, tenacity: 0, vitality: 0, vigor: 0, focus: 0, perspicacity: 0, region: 3 };
const STAT_MAX = { health: 1000, tenacity: 100, vitality: 100, vigor: 100, focus: 100, perspicacity: 100, region: 3 };

const MAX_NAME = 50;
const MAX_SKILL_TOTAL = 10;
const MAX_SPEC_TOTAL = 4;
const MAX_ENHANCEMENTS = 3;
const MAX_ASCENSION = 18;
const MAX_CHARMS = 12;
const MAX_CZ_ABILITIES = 30;

const CZ_ABILITIES = new Set();
for (const tree of czAbilitiesData.trees || []) {
    for (const skill of tree.skills || []) {
        if (skill?.name) CZ_ABILITIES.add(skill.name);
    }
}

function hasItem(itemData, name) {
    return Boolean(itemData) && Object.prototype.hasOwnProperty.call(itemData, name);
}

function findClass(skillsData, className) {
    if (!skillsData || !Array.isArray(skillsData.classes) || !className) return null;
    const wanted = String(className).toLowerCase();
    return skillsData.classes.find((c) => (c.className || '').toLowerCase() === wanted) || null;
}

// Mirrors CharmShortener.parseCharmData (which the builder runs on restore):
// every entry must resolve to a real charm, and fields the builder reads
// blindly (the class letter) must exist.
function charmValueIsValid(value, itemData) {
    if (!value || value === 'None') return true;
    const entries = String(value).split(',');
    if (entries.length > MAX_CHARMS) return false;
    return entries.every((entry) => {
        const fields = entry.split('-');
        if (fields.length < 4) return false;
        const prefix = fields[0].replaceAll('_', ' ');
        const suffix = fields[1].replaceAll('_', ' ');
        const power = Number(fields[2]);
        const classLetter = fields[3];
        if (!Number.isFinite(power) || !classLetter) return false;
        return Object.keys(itemData).some((name) => {
            const item = itemData[name];
            return (
                item &&
                item.type === 'Charm' &&
                typeof item.name === 'string' &&
                typeof item.class_name === 'string' &&
                item.class_name.length > 0 &&
                item.name.substring(0, 3) === prefix &&
                item.name.includes(suffix) &&
                item.power == power &&
                item.class_name[0] === classLetter
            );
        });
    });
}

function parsePointEntries(raw) {
    const entries = [];
    for (const part of String(raw || '').split(',')) {
        const idx = part.indexOf(':');
        if (idx <= 0) continue;
        const id = part.slice(0, idx);
        const points = Number(part.slice(idx + 1));
        if (!id || !Number.isInteger(points) || points <= 0) continue;
        entries.push([id, points]);
    }
    return entries;
}

// Keeps only known ids, in order, within a total point budget. Entries that
// would push the build over the budget are dropped.
function limitPointEntries(entries, knownIds, budget) {
    const out = [];
    let total = 0;
    for (const [id, points] of entries) {
        if (!knownIds.has(id) || total + points > budget) continue;
        total += points;
        out.push([id, points]);
    }
    return out;
}

function limitList(values, known, max) {
    const out = [];
    for (const value of values) {
        if (!value || !known.has(value) || out.includes(value)) continue;
        out.push(value);
        if (out.length >= max) break;
    }
    return out;
}

// Rebuilds a legacy querystring with only known, in-range values. Returns
// { ok: false } when the payload is not a build at all (no equipment slot).
function sanitizeLegacyString(decoded, itemData, skillsData) {
    let params;
    try {
        params = new URLSearchParams(decoded);
    } catch (e) {
        return { ok: false };
    }
    if (!params.has('m')) return { ok: false };

    let legacy = '';
    for (const shortKey of ITEM_SHORT_KEYS) {
        const raw = params.get(shortKey);
        const value = raw && (raw === 'None' || hasItem(itemData, raw)) ? raw : 'None';
        legacy += `${shortKey}=${encodeURIComponent(value)}&`;
    }

    const charm = params.get('charm');
    legacy += `charm=${encodeURIComponent(charmValueIsValid(charm, itemData) ? charm : 'None')}`;

    const name = params.get('name');
    if (name) legacy += `&name=${encodeURIComponent(name.slice(0, MAX_NAME))}`;

    const classRaw = params.get('cl');
    const classData = findClass(skillsData, classRaw);
    if (classData) legacy += `&cl=${encodeURIComponent(classRaw)}`;

    const classIds = new Set((classData?.skills || []).map((s) => s.scoreboardId));
    if (classData) {
        const skills = limitPointEntries(parsePointEntries(params.get('sk')), classIds, MAX_SKILL_TOTAL);
        if (skills.length > 0) legacy += `&sk=${skills.map(([id, points]) => `${id}:${points}`).join(',')}`;
    }

    for (const key of STAT_KEYS) {
        const raw = params.get(key);
        if (raw === null || raw === '') continue;
        const value = Number(raw);
        if (!Number.isInteger(value) || value === STAT_DEFAULTS[key] || value < 0 || value > STAT_MAX[key]) continue;
        legacy += `&${key}=${value}`;
    }

    if (classData) {
        const specRaw = params.get('sp');
        const specData = specRaw ? classData.specs?.find((s) => s.specName === specRaw) : null;
        if (specData) legacy += `&sp=${encodeURIComponent(specRaw)}`;
        const specIds = new Set((specData?.specSkills || []).map((s) => s.scoreboardId));
        const specSkills = limitPointEntries(parsePointEntries(params.get('ssk')), specIds, MAX_SPEC_TOTAL);
        if (specSkills.length > 0) {
            legacy += `&ssk=${specSkills.map(([id, points]) => `${id}:${points}`).join(',')}`;
        }
    }

    const enhancements = limitList((params.get('en') || '').split(','), classIds, MAX_ENHANCEMENTS);
    if (enhancements.length > 0) legacy += `&en=${enhancements.join(',')}`;

    const cz = limitList(
        (params.get('cz') || '').split(',').map((part) => part.split(':')[0]),
        CZ_ABILITIES,
        MAX_CZ_ABILITIES
    );
    if (cz.length > 0) legacy += `&cz=${encodeURIComponent(cz.join(','))}`;

    const asc = params.get('asc');
    if (asc !== null && asc !== '') {
        const value = Number(asc);
        if (Number.isInteger(value) && value > 0 && value <= MAX_ASCENSION) legacy += `&asc=${value}`;
    }

    return { ok: true, legacy };
}

function sanitizedLegacyFor(token, itemData, skillsData) {
    const decoded = decodeBuildParam(token, itemData);
    if (!decoded || typeof decoded !== 'string') return null;
    const result = sanitizeLegacyString(decoded, itemData, skillsData);
    if (!result.ok) return null;
    return { decoded, legacy: result.legacy };
}

// Token to store: legacy payloads are normalized to their sanitized form,
// binary payloads are kept only when they are already clean.
export function sanitizeBuildTokenForStorage(token, itemData, skillsData) {
    if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, token: null };
    const result = sanitizedLegacyFor(token, itemData, skillsData);
    if (!result) return { ok: false, token: null };
    if (token.startsWith(BINARY_PREFIX) && result.legacy !== result.decoded) return { ok: false, token: null };
    return { ok: true, token: result.legacy === result.decoded ? token : result.legacy };
}

// Token to render: never returns junk, even for rows saved before the checks
// above existed.
export function sanitizeBuildTokenForDisplay(token, itemData, skillsData) {
    if (typeof token !== 'string' || !token) return token;
    const result = sanitizedLegacyFor(token, itemData, skillsData);
    if (!result) return token;
    return result.legacy === result.decoded ? token : result.legacy;
}
