import { CLASS_SKILL_CALCULATIONS, SPEC_CALCULATIONS } from '../../data/skillCalculations';

const normalizeClass = (name) =>
    name && name !== 'none' ? String(name).charAt(0).toUpperCase() + String(name).slice(1).toLowerCase() : '';

// Calculation entries for a class and (optionally) its selected spec.
export function skillCalcEntries(gameClass, spec) {
    const className = normalizeClass(gameClass);
    if (!className) return [];
    const entries = [...(CLASS_SKILL_CALCULATIONS[className] || [])];
    if (spec) entries.push(...(SPEC_CALCULATIONS[`${className}:${spec}`] || []));
    return entries;
}

// Whether an entry counts for the current build: spec passives always do,
// class/spec skills need at least one point.
export function isSkillCalcLearned(entry, skillPoints, specSkillPoints) {
    if (entry.passive) return true;
    if (entry.specSkill) return (specSkillPoints && specSkillPoints[entry.id]) >= 1;
    return (skillPoints && skillPoints[entry.id]) >= 1;
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
        healingMultiplier: 1,
        damageTaken: { all: 1, melee: 1, projectile: 1, magic: 1, blast: 1, fire: 1, fall: 1 },
    };
}

function applyEntry(effects, stats) {
    if (!stats) return;
    const all = Number(stats.allDamagePercent) || 0;
    effects.healthPercent += Number(stats.healthPercent) || 0;
    effects.speedPercent += Number(stats.speedPercent) || 0;
    effects.attackSpeedPercent += Number(stats.attackSpeedPercent) || 0;
    effects.meleeDamagePercent += all + (Number(stats.meleeDamagePercent) || 0);
    effects.projectileDamagePercent += all + (Number(stats.projectileDamagePercent) || 0);
    effects.magicDamagePercent += all + (Number(stats.magicDamagePercent) || 0);
    effects.critFlatDamage += Number(stats.critFlatDamage) || 0;
    // Knockback percentages become the [0, 1] attribute the engine multiplies
    // by 10 for display.
    effects.knockbackRes += (Number(stats.knockbackPercent) || 0) / 10;
    if (stats.healingPercent) effects.healingMultiplier *= 1 + Number(stats.healingPercent) / 100;
    if (stats.resistancePercent) effects.damageTaken.all *= Math.max(0, 1 - Number(stats.resistancePercent) / 100);
    if (stats.ailmentResistancePercent) {
        effects.damageTaken.ailment *= Math.max(0, 1 - Number(stats.ailmentResistancePercent) / 100);
    }
}

export function computeSkillEffects({ gameClass, spec, skillPoints, specSkillPoints, enhancements, enabled = [] }) {
    const effects = emptyEffects();
    const enabledSet = new Set(enabled || []);
    for (const entry of skillCalcEntries(gameClass, spec)) {
        // Calculations are opt-in: only the toggled-on entries count.
        if (!enabledSet.has(entry.id)) continue;
        if (!isSkillCalcLearned(entry, skillPoints, specSkillPoints)) continue;
        const enhanced = Boolean(enhancements && enhancements[entry.id]);
        const stats = enhanced && entry.enhancedEffects ? entry.enhancedEffects : entry.effects;
        applyEntry(effects, stats);
    }
    return effects;
}

// Combine two effect objects (potions + skills) into the one the stats engine
// consumes: additive fields add, multipliers multiply.
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
    ]) {
        out[key] = (Number(a[key]) || 0) + (Number(b[key]) || 0);
    }
    out.healingMultiplier = (a.healingMultiplier ?? 1) * (b.healingMultiplier ?? 1);
    for (const type of ['all', 'melee', 'projectile', 'magic', 'blast', 'fire', 'fall', 'ailment']) {
        out.damageTaken[type] = (a.damageTaken?.[type] ?? 1) * (b.damageTaken?.[type] ?? 1);
    }
    return out;
}
