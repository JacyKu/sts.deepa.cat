// Link-preview helpers for the builder (used for og:/twitter: metadata server-side).
import { decodeBuildParam } from './builder/buildUrlCodec';
import CharmShortener from './builder/charmShortener';

function parseCharmPreview(charmValue, itemData) {
    if (!charmValue || charmValue === 'None') return { totalPower: 0, items: [] };
    if (!itemData) return { totalPower: 0, items: [] };

    try {
        const charmKeys = CharmShortener.parseCharmData(String(charmValue), itemData);
        const items = charmKeys
            .map((k) => itemData[k])
            .filter(Boolean)
            .map((c) => {
                const power = Number(c.power);
                return {
                    name: c.name,
                    power: Number.isFinite(power) ? power : null,
                    tier: c.tier || null,
                    class_name: c.class_name || null,
                };
            });

        const totalPower = charmKeys
            .map((k) => Number(itemData[k]?.power))
            .filter((p) => Number.isFinite(p))
            .reduce((sum, p) => sum + p, 0);

        return { totalPower, items };
    } catch (e) {
        return { totalPower: 0, items: [] };
    }
}

// The token stores Darkest Depths as region 2 and Celestial Zenith as region
// 3 (the builder maps 'dd'/'cz' onto those). They're only distinguishable
// from plain Isles/Ring when the build actually has CZ/DD abilities, so the
// label depends on hasCz.
export function getRegionLabel(region, hasCz = false) {
    if (hasCz) {
        if (region === 2) return 'Darkest Depths';
        if (region === 3) return 'Celestial Zenith';
    }
    if (region === 1) return 'Valley';
    if (region === 2) return 'Isles';
    if (region === 3) return 'Ring';
    return null;
}

export function getLinkPreviewData(build, itemData, skillsData) {
    const decoded = decodeBuildParam(build, itemData);
    if (!decoded) return null;

    try {
        const params = new URLSearchParams(decoded);
        const itemKey = (shortKey, fallback = 'None') => params.get(shortKey) || fallback;

        const items = {
            mainhand: itemKey('m'),
            offhand: itemKey('o'),
            helmet: itemKey('h'),
            chestplate: itemKey('c'),
            leggings: itemKey('l'),
            boots: itemKey('b'),
        };

        for (const key of Object.keys(items)) {
            if (!items[key] || !Object.keys(itemData).includes(items[key])) items[key] = 'None';
        }

        const charmValue = params.get('charm') || 'None';
        const charmPreview = parseCharmPreview(charmValue, itemData);

        const nameValue = params.get('name') || null;

        const className = params.get('cl') || null;
        // The binary token omits stats at their defaults, so a Ring build has
        // no region param at all. Number(null) would be 0, which would break
        // every region check — default to 3 when absent.
        const regionRaw = params.get('region');
        const region =
            regionRaw === null || regionRaw === ''
                ? 3
                : Number.isFinite(Number(regionRaw))
                  ? Number(regionRaw)
                  : 3;
        const ascRaw = params.get('asc');
        const ascension = Number.isFinite(Number(ascRaw)) ? Number(ascRaw) : 0;

        const skills = [];
        const skRaw = params.get('sk');
        if (skRaw) {
            for (const part of skRaw.split(',')) {
                const [id, pts] = part.split(':');
                const points = Number(pts);
                if (id && Number.isInteger(points) && points > 0) skills.push({ id, points });
            }
        }
        const spec = params.get('sp') || null;
        const specSkills = [];
        const sskRaw = params.get('ssk');
        if (sskRaw) {
            for (const part of sskRaw.split(',')) {
                const [id, pts] = part.split(':');
                const points = Number(pts);
                if (id && Number.isInteger(points) && points > 0) specSkills.push({ id, points });
            }
        }
        const enhancements = [];
        const enRaw = params.get('en');
        if (enRaw) {
            for (const key of enRaw.split(',')) {
                if (key) enhancements.push(key);
            }
        }
        // Celestial Zenith / Depths abilities (names only — rarity is gone,
        // everything is always Twisted; legacy "Name:rarity" parses to name).
        const czAbilities = [];
        const czRaw = params.get('cz');
        if (czRaw) {
            for (const part of czRaw.split(',')) {
                const name = part.split(':')[0];
                if (name) czAbilities.push(name);
            }
        }
        // resolve display names from the skills data when available
        if (skillsData && Array.isArray(skillsData.classes)) {
            const classData = className
                ? skillsData.classes.find((c) => (c.className || '').toLowerCase() == className.toLowerCase())
                : null;
            for (const skill of skills) {
                const match = classData ? classData.skills.find((s) => s.scoreboardId == skill.id) : null;
                if (match) {
                    skill.name = match.displayName;
                    skill.shortName = match.shortName;
                }
            }
            const specData = classData && spec ? classData.specs?.find((s) => s.specName == spec) : null;
            for (const skill of specSkills) {
                const match = specData ? specData.specSkills.find((s) => s.scoreboardId == skill.id) : null;
                if (match) {
                    skill.name = match.displayName;
                    skill.shortName = match.shortName;
                }
            }
            for (let i = 0; i < enhancements.length; i++) {
                const id = enhancements[i];
                const match = classData ? classData.skills.find((s) => s.scoreboardId == id) : null;
                enhancements[i] = { id, name: match ? match.displayName : id };
            }
        }

        return {
            name: nameValue ? decodeURIComponent(nameValue) : null,
            items,
            charms: charmPreview,
            className,
            skills,
            spec,
            specSkills,
            enhancements,
            czAbilities,
            ascension,
            region,
            // Human-readable region for DD/CZ builds ("Darkest Depths" /
            // "Celestial Zenith"); null for plain Valley/Isles/Ring, where
            // callers keep showing the compact "R1".."R3" form.
            regionLabel: czAbilities.length > 0 ? getRegionLabel(region, true) : null,
        };
    } catch (e) {
        return null;
    }
}

// Discord wraps long embed descriptions itself, so charm names just join in one line.
// `infusions` (optional) is a slot -> infusion-name map from the DB state.
export function getLinkPreviewDescription(build, itemData, skillsData, infusions) {
    const data = getLinkPreviewData(build, itemData, skillsData);
    if (!data) return '';

    const i = data.items;

    const formatItem = (itemKey) => {
        if (!itemKey || itemKey === 'None') return 'None';
        const displayName = itemData?.[itemKey]?.name || itemKey;
        // The card image already marks EX items with a purple tag, so the
        // text description must not repeat the prefix.
        return displayName.replace(/^EX\s+/, '');
    };

    const charmInline =
        data.charms.items.length === 0
            ? '🧿 Charms: None'
            : `🧿 Charms (${data.charms.totalPower}★): ${data.charms.items
                  .map((charm) => (charm.power != null ? `${charm.name} ${charm.power}★` : charm.name))
                  .join(', ')}`;    // The card image already shows class/spec/skills; the text keeps only gear + charms.
    const EMOJI = {
        mainhand: '⚔️',
        offhand: '🛡️',
        helmet: '⛑️',
        chestplate: '🦺',
        leggings: '👖',
        boots: '🥾',
    };

    const parts = [
        `${EMOJI.mainhand} ${formatItem(i.mainhand)}`,
        `${EMOJI.offhand} ${formatItem(i.offhand)}`,
        `${EMOJI.helmet} ${formatItem(i.helmet)}`,
        `${EMOJI.chestplate} ${formatItem(i.chestplate)}`,
        `${EMOJI.leggings} ${formatItem(i.leggings)}`,
        `${EMOJI.boots} ${formatItem(i.boots)}`,
    ];

    // Valley (1) and Isles (2) — including Darkest Depths — have no charms.
    if (data.region > 2) {
        parts.push(charmInline);
    }

    if (data.czAbilities.length > 0) {
        parts.push(`🔮 CZ: ${data.czAbilities.join(', ')}`);
    }

    if (data.ascension > 0) {
        parts.push(`🪜 Ascension ${data.ascension}`);
    }

    if (infusions && Object.keys(infusions).length > 0) {
        const names = Object.values(infusions).filter((v) => v && v !== 'None');
        if (names.length > 0) {
            parts.push(`✨ Infusions: ${names.join(', ')}`);
        }
    }

    // Discord renders newlines in embed descriptions.
    return parts.join('\n');
}

// The build name shown when the user hasn't typed one: "R3 Swordsage build" /
// "R1 Rogue build" (region 1-3, spec name if picked, otherwise the class),
// or "Darkest Depths Berserker build" for the special regions.
export function getEffectiveBuildName(data, buildName) {
    const explicitName = data?.name || (buildName && buildName !== 'Monumenta Builder' ? buildName : null);
    if (explicitName) return explicitName;
    if (data?.className) {
        const region = [1, 2, 3].includes(data.region) ? data.region : 3;
        const regionName = data.regionLabel || `R${region}`;
        return `${regionName} ${data.spec || data.className} build`;
    }
    return null;
}

export function getLinkPreviewTitle(build, itemData, buildName, skillsData) {
    const data = getLinkPreviewData(build, itemData, skillsData);
    const name = getEffectiveBuildName(data, buildName);
    return (name ? name + ' - ' : '') + 'Monumenta Builder';
}
