// Works out a build's region and class/spec from what is equipped:
//
//   region - the region of the equipped gear (items carry Valley/Isles/Ring)
//   class  - the equipped charms' own class_name (Generalist works with any)
//   spec   - the skills the equipped charms' stats belong to: a charm stat is
//            keyed by the skill it modifies, and every skill belongs to a class,
//            with spec skills belonging to a specialization
//
// Pure (no React, no browser APIs) so it can be exercised from Node.

const REGION_VALUE_BY_NAME = { Valley: 1, Isles: 2, Ring: 3 };

function statToken(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// skill token -> { className, specName }, built once per skills payload (the
// loader returns the same object until the data files change).
let indexCache = null;
let indexCacheKey = null;

function skillIndex(skillsData) {
    if (indexCache && indexCacheKey === skillsData) return indexCache;
    const index = new Map();
    const add = (skill, className, specName) => {
        if (!skill) return;
        for (const value of [skill.name, skill.displayName]) {
            const token = value ? statToken(value) : '';
            if (token && !index.has(token)) index.set(token, { className, specName: specName || null });
        }
    };
    for (const cls of (skillsData && skillsData.classes) || []) {
        if (!cls.className) continue;
        for (const skill of cls.skills || []) add(skill, cls.className, null);
        add(cls.classPassive, cls.className, null);
        for (const spec of cls.specs || []) {
            for (const skill of spec.specSkills || []) add(skill, cls.className, spec.specName);
            add(spec.specPassive, cls.className, spec.specName);
        }
    }
    indexCache = index;
    indexCacheKey = skillsData;
    return index;
}

// The skill a stat belongs to: the stat's token either is the skill's token or
// starts with it ("totemic_consecration_damage_percent" -> "Totemic
// Consecration"). Longer matches are not needed - the skill token is the stem.
function skillForStat(index, token) {
    const exact = index.get(token);
    if (exact) return exact;
    for (const [key, value] of index) {
        if (token.startsWith(key + '_')) return value;
    }
    return null;
}

// 1 (King's Valley), 2 (Celsian Isles) or 3 (Architect's Ring); null when no
// equipped item carries a region.
export function detectRegion(items) {
    const votes = new Map();
    for (const item of items || []) {
        const value = item && item.region ? REGION_VALUE_BY_NAME[item.region] : null;
        if (value) votes.set(value, (votes.get(value) || 0) + 1);
    }
    let best = null;
    for (const [value, count] of votes) {
        if (!best || count > best.count) best = { value, count };
    }
    return best ? best.value : null;
}

// { className, specName } - either may be null when nothing points at it. The
// class's own field counts double, so a charm's class is trusted over a stray
// stat that happens to parse as another class's skill.
export function detectClassAndSpec(charms, skillsData) {
    const index = skillIndex(skillsData);
    const classVotes = new Map();
    const specVotes = new Map(); // specName -> { className, count }
    for (const charm of charms || []) {
        if (!charm) continue;
        if (charm.class_name && charm.class_name !== 'Generalist') {
            classVotes.set(charm.class_name, (classVotes.get(charm.class_name) || 0) + 2);
        }
        for (const stat of Object.keys(charm.stats || {})) {
            const hit = skillForStat(index, statToken(stat));
            if (!hit) continue;
            classVotes.set(hit.className, (classVotes.get(hit.className) || 0) + 1);
            if (!hit.specName) continue;
            const entry = specVotes.get(hit.specName) || { className: hit.className, count: 0 };
            entry.count += 1;
            specVotes.set(hit.specName, entry);
        }
    }
    let className = null;
    for (const [name, count] of classVotes) {
        if (className === null || count > classVotes.get(className)) className = name;
    }
    // A specialization only means something for the class it belongs to.
    let specName = null;
    for (const [name, entry] of specVotes) {
        if (className && entry.className !== className) continue;
        if (specName === null || entry.count > specVotes.get(specName).count) specName = name;
    }
    return { className, specName };
}

// Everything at once, for the builder's "detect" action.
export function detectBuild({ items, charms, skillsData } = {}) {
    return { region: detectRegion(items), ...detectClassAndSpec(charms, skillsData) };
}
