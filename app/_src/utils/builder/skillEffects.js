import { CLASS_SKILL_CALCULATIONS, SPEC_CALCULATIONS } from '../../data/skillCalculations';

const normalizeClass = (name) =>
    name && name !== 'none' ? String(name).charAt(0).toUpperCase() + String(name).slice(1).toLowerCase() : '';

export function skillCalcEntries(gameClass, spec) {
    const className = normalizeClass(gameClass);
    if (!className) return [];
    const entries = [...(CLASS_SKILL_CALCULATIONS[className] || [])];
    if (spec) entries.push(...(SPEC_CALCULATIONS[`${className}:${spec}`] || []));
    return entries;
}

export function isSkillCalcLearned(entry, skillPoints, specSkillPoints) {
    if (entry.passive) return true;
    if (entry.specSkill) return (specSkillPoints && specSkillPoints[entry.id]) >= 1;
    return (skillPoints && skillPoints[entry.id]) >= 1;
}

export function skillCalcLevel(entry, skillPoints, specSkillPoints) {
    if (entry.passive) return 1;
    const points = entry.specSkill
        ? specSkillPoints && specSkillPoints[entry.id]
        : skillPoints && skillPoints[entry.id];
    return (points || 0) >= 2 ? 2 : 1;
}

function emptyEffects() {
    return {
        healthPercent: 0,
        speedPercent: 0,
        attackSpeedPercent: 0,
        knockbackRes: 0,
        regenLevels: 0,
        meleeDamagePercent: 0,
        projectileDamagePercent: 0,
        magicDamagePercent: 0,
        cooldownReduction: 0,
        critFlatDamage: 0,
        flatMeleeDamage: 0,
        classAllDamagePercent: 0,
        frenzySpeedPercent: 0,
        frenzyBonusDamagePercent: 0,
        weaponMasterySpeedPercent: 0,
        toughnessHealthPercent: 0,
        toughnessHealingPercent: 0,
        healingMultiplier: 1,
        damageTaken: { all: 1, melee: 1, projectile: 1, magic: 1, blast: 1, fire: 1, fall: 1, ailment: 1 },
    };
}

function emptyEntryEffects() {
    return {
        healthPercent: 0,
        speedPercent: 0,
        attackSpeedPercent: 0,
        knockbackPercent: 0,
        regenLevels: 0,
        meleeDamagePercent: 0,
        projectileDamagePercent: 0,
        magicDamagePercent: 0,
        cooldownReduction: 0,
        critFlatDamage: 0,
        flatMeleeDamage: 0,
        classAllDamagePercent: 0,
        frenzySpeedPercent: 0,
        frenzyBonusDamagePercent: 0,
        weaponMasterySpeedPercent: 0,
        toughnessHealthPercent: 0,
        toughnessHealingPercent: 0,
        healingPercent: 0,
        resistancePercent: 0,
        ailmentResistancePercent: 0,
    };
}

const num = (value) => Number(value) || 0;

function addRaw(target, field, value) {
    if (!value) return;
    if (field === 'allDamagePercent') {
        target.meleeDamagePercent = (target.meleeDamagePercent || 0) + value;
        target.projectileDamagePercent = (target.projectileDamagePercent || 0) + value;
        target.magicDamagePercent = (target.magicDamagePercent || 0) + value;
        return;
    }
    target[field] = (target[field] || 0) + value;
}

function addStats(target, stats) {
    if (!stats) return;
    const all = num(stats.allDamagePercent);
    target.healthPercent += num(stats.healthPercent);
    target.speedPercent += num(stats.speedPercent);
    target.attackSpeedPercent += num(stats.attackSpeedPercent);
    target.knockbackPercent += num(stats.knockbackPercent);
    target.regenLevels += num(stats.regenLevels);
    target.meleeDamagePercent += all + num(stats.meleeDamagePercent);
    target.projectileDamagePercent += all + num(stats.projectileDamagePercent);
    target.magicDamagePercent += all + num(stats.magicDamagePercent);
    target.cooldownReduction += num(stats.cooldownReduction);
    target.critFlatDamage += num(stats.critFlatDamage);
    target.flatMeleeDamage += num(stats.flatMeleeDamage);
    target.classAllDamagePercent += num(stats.classAllDamagePercent);
    target.frenzySpeedPercent += num(stats.frenzySpeedPercent);
    target.frenzyBonusDamagePercent += num(stats.frenzyBonusDamagePercent);
    target.weaponMasterySpeedPercent += num(stats.weaponMasterySpeedPercent);
    target.toughnessHealthPercent += num(stats.toughnessHealthPercent);
    target.toughnessHealingPercent += num(stats.toughnessHealingPercent);
    target.healingPercent += num(stats.healingPercent);
    target.resistancePercent += num(stats.resistancePercent);
    target.ailmentResistancePercent += num(stats.ailmentResistancePercent);
}

function applyEntryEffects(target, entry) {
    target.healthPercent += entry.healthPercent;
    target.speedPercent += entry.speedPercent;
    target.attackSpeedPercent += entry.attackSpeedPercent;
    target.knockbackRes += entry.knockbackPercent / 10;
    target.regenLevels += entry.regenLevels;
    target.meleeDamagePercent += entry.meleeDamagePercent;
    target.projectileDamagePercent += entry.projectileDamagePercent;
    target.magicDamagePercent += entry.magicDamagePercent;
    target.cooldownReduction += entry.cooldownReduction;
    target.critFlatDamage += entry.critFlatDamage;
    target.flatMeleeDamage += entry.flatMeleeDamage;
    target.classAllDamagePercent += entry.classAllDamagePercent;
    target.frenzySpeedPercent += entry.frenzySpeedPercent;
    target.frenzyBonusDamagePercent += entry.frenzyBonusDamagePercent;
    target.weaponMasterySpeedPercent += entry.weaponMasterySpeedPercent;
    target.toughnessHealthPercent += entry.toughnessHealthPercent;
    target.toughnessHealingPercent += entry.toughnessHealingPercent;
    if (entry.healingPercent) {
        target.healingMultiplier *= Math.max(0, 1 + entry.healingPercent / 100);
    }
    if (entry.resistancePercent) {
        target.damageTaken.all *= Math.max(0, 1 - entry.resistancePercent / 100);
    }
    if (entry.ailmentResistancePercent) {
        target.damageTaken.ailment *= Math.max(0, 1 - entry.ailmentResistancePercent / 100);
    }
}

function selectEffects(entry, level, enhanced) {
    if (enhanced) {
        if (level >= 2 && entry.enhancedEffectsLv2) return entry.enhancedEffectsLv2;
        if (entry.enhancedEffects) return entry.enhancedEffects;
    }
    if (level >= 2 && entry.effectsLv2) return entry.effectsLv2;
    return entry.effects || null;
}

function charmValue(charmTotals, key) {
    return num(charmTotals && charmTotals[key] && charmTotals[key].value);
}

function stackCount(value, max) {
    if (value === undefined || value === null || value === '') return max;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return max;
    return Math.min(max, Math.max(0, parsed));
}

export function resolveSkillCalcEntry(entry, level, enhanced, charmTotals = {}) {
    const base = selectEffects(entry, level, enhanced);
    const stats = { ...(base || {}) };
    for (const [field, key] of Object.entries(entry.charmStats || {})) {
        const value = charmValue(charmTotals, key);
        if (!value) continue;
        if (!entry.flagPrefix && !(base && field in base)) continue;
        addRaw(stats, field, value);
    }
    for (const [field, key] of Object.entries(entry.charmScale || {})) {
        const value = charmValue(charmTotals, key);
        if (!value || typeof stats[field] !== 'number') continue;
        stats[field] *= 1 + value / 100;
    }
    let stacks = null;
    if (entry.stacks) {
        const baseMax = level >= 2 && entry.stacks.maxLv2 !== undefined ? entry.stacks.maxLv2 : entry.stacks.max;
        const maxCharm =
            entry.charmMaxStats && entry.charmMaxStats.max ? charmValue(charmTotals, entry.charmMaxStats.max) : 0;
        const perStack = {
            ...(level >= 2 && entry.stacks.perStackLv2 ? entry.stacks.perStackLv2 : entry.stacks.perStack),
        };
        for (const [field, key] of Object.entries(entry.charmStackStats || {})) {
            const value = charmValue(charmTotals, key);
            if (value) addRaw(perStack, field, value);
        }
        stacks = {
            name: entry.stacks.name,
            label: entry.stacks.label,
            hint: entry.stacks.hint,
            max: baseMax + maxCharm,
            perStack,
        };
    }
    return { stats, stacks };
}

export function buildSkillCalcEntries({
    gameClass,
    spec,
    skillPoints,
    specSkillPoints,
    enhancements,
    enabled = [],
    charmTotals = {},
}) {
    const enabledSet = new Set(enabled || []);
    const entries = [];
    for (const entry of skillCalcEntries(gameClass, spec)) {
        if (!enabledSet.has(entry.id)) continue;
        if (!isSkillCalcLearned(entry, skillPoints, specSkillPoints)) continue;
        const level = skillCalcLevel(entry, skillPoints, specSkillPoints);
        const enhanced = entry.passive ? false : Boolean(enhancements && enhancements[entry.id]);
        const resolved = resolveSkillCalcEntry(entry, level, enhanced, charmTotals);
        entries.push({ id: entry.id, stats: resolved.stats, stacks: resolved.stacks });
    }
    return entries;
}

export function aggregateSkillEffects(entries, stackValues) {
    const effects = emptyEffects();
    for (const entry of entries || []) {
        const raw = emptyEntryEffects();
        addStats(raw, entry.stats);
        if (entry.stacks) {
            const count = stackCount(stackValues && stackValues[entry.stacks.name], entry.stacks.max);
            if (count > 0) {
                for (const [field, value] of Object.entries(entry.stacks.perStack)) {
                    addRaw(raw, field, num(value) * count);
                }
            }
        }
        applyEntryEffects(effects, raw);
    }
    return effects;
}

export function computeSkillEffects({
    gameClass,
    spec,
    skillPoints,
    specSkillPoints,
    enhancements,
    enabled = [],
    charmTotals = {},
    stackValues = {},
}) {
    const entries = buildSkillCalcEntries({
        gameClass,
        spec,
        skillPoints,
        specSkillPoints,
        enhancements,
        enabled,
        charmTotals,
    });
    return aggregateSkillEffects(entries, stackValues);
}

export function mergeBuffEffects(first, second) {
    const a = first || emptyEffects();
    const b = second || emptyEffects();
    const out = {
        ...a,
        damageTaken: { ...(a.damageTaken || {}) },
    };
    for (const key of [
        'healthPercent',
        'speedPercent',
        'attackSpeedPercent',
        'knockbackRes',
        'regenLevels',
        'meleeDamagePercent',
        'projectileDamagePercent',
        'magicDamagePercent',
        'cooldownReduction',
        'critFlatDamage',
        'flatMeleeDamage',
        'classAllDamagePercent',
        'frenzySpeedPercent',
        'frenzyBonusDamagePercent',
        'weaponMasterySpeedPercent',
        'toughnessHealthPercent',
        'toughnessHealingPercent',
    ]) {
        out[key] = (Number(a[key]) || 0) + (Number(b[key]) || 0);
    }
    out.healingMultiplier = (a.healingMultiplier ?? 1) * (b.healingMultiplier ?? 1);
    for (const type of ['all', 'melee', 'projectile', 'magic', 'blast', 'fire', 'fall', 'ailment']) {
        out.damageTaken[type] = (a.damageTaken?.[type] ?? 1) * (b.damageTaken?.[type] ?? 1);
    }
    return out;
}
