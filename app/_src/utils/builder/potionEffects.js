// Turns the potion/food buffs the player selects into builder stat inputs.
//
// The item data gives each Consumable an `effects` list (EffectType,
// EffectStrength as a fraction, EffectDuration). The builder shows the stats
// while the effect is active, so durations are ignored. Effects of the same
// type do not stack in game: only the strongest strength of each type counts.
//
// Only effects the stat cards actually model are mapped; cosmetic/utility ones
// (Night Vision, Water Breath, Haste, experience, ...) and instant heals are
// left out.
const DAMAGE_TYPES = {
    MeleeDamage: 'meleeDamagePercent',
    ProjectileDamage: 'projectileDamagePercent',
    MagicDamage: 'magicDamagePercent',
};
const RESISTANCE_TYPES = {
    MeleeResistance: 'melee',
    ProjectileResistance: 'projectile',
    MagicResistance: 'magic',
    BlastResistance: 'blast',
    FireResistance: 'fire',
    FallResistance: 'fall',
};
const VULNERABILITY_TYPES = {
    MeleeVulnerability: 'melee',
    ProjectileVulnerability: 'projectile',
    MagicVulnerability: 'magic',
    BlastVulnerability: 'blast',
    FireVulnerability: 'fire',
    FallVulnerability: 'fall',
};

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
        // Healing received multiplier (PercentHeal effects: Heal/AntiHeal).
        healingMultiplier: 1,
        // Multipliers on incoming damage, per damage type ("all" applies to
        // every type before the type-specific one).
        damageTaken: { all: 1, melee: 1, projectile: 1, magic: 1, blast: 1, fire: 1, fall: 1 },
    };
}

export function computePotionEffects(rawPotions, itemData) {
    const effects = emptyEffects();
    if (!rawPotions || !itemData) return effects;

    let names = rawPotions;
    if (typeof rawPotions === 'string') {
        try {
            names = JSON.parse(rawPotions);
        } catch (e) {
            names = rawPotions.split(',');
        }
    }
    if (!Array.isArray(names) || names.length === 0) return effects;

    // Strongest strength per effect type across the selected consumables.
    const strongest = new Map();
    for (const name of names) {
        const item = itemData[name];
        if (!item || !Array.isArray(item.effects)) continue;
        for (const effect of item.effects) {
            const type = effect && effect.EffectType;
            const strength = Number(effect && effect.EffectStrength);
            if (!type || !Number.isFinite(strength)) continue;
            if (!strongest.has(type) || strength > strongest.get(type)) strongest.set(type, strength);
        }
    }

    const value = (type) => strongest.get(type) || 0;

    // Additive percentages (the same pools gear stats use).
    effects.healthPercent = 100 * (value('MaxHealthIncrease') - value('MaxHealthDecrease'));
    effects.speedPercent = 100 * (value('Speed') - value('Slow'));
    effects.attackSpeedPercent = 100 * (value('AttackSpeed') - value('NegativeAttackSpeed'));
    // Item knockback resistance is a [0, 1] attribute that the builder turns
    // into a percentage by multiplying by 10.
    effects.knockbackRes = 10 * (value('KnockbackResist') - value('NegativeKnockbackResist'));
    effects.regenLevels = value('Regeneration');
    effects.cooldownReduction = value('AbilityCooldownDecrease') - value('AbilityCooldownIncrease');
    // Heal and AntiHeal both create a PercentHeal effect in game, which scales
    // every healing event by (1 + amount). Negative AntiHeal is clamped at zero
    // so a 100% anti-heal consumable stops healing instead of going negative.
    effects.healingMultiplier = Math.max(0, (1 + value('Heal')) * (1 - value('AntiHeal')));

    // "damage" is the generic damage buff (Strength): it raises all three
    // damage cards. The type-specific buffs add on top.
    const allDamage = 100 * value('damage');
    effects.meleeDamagePercent = allDamage + 100 * value('MeleeDamage');
    effects.projectileDamagePercent = allDamage + 100 * value('ProjectileDamage');
    effects.magicDamagePercent = allDamage + 100 * value('MagicDamage');

    // Generic resistance/vulnerability apply to every damage type.
    effects.damageTaken.all = (1 - value('Resistance')) * (1 + value('Vulnerability'));
    for (const [type, key] of Object.entries(RESISTANCE_TYPES)) {
        effects.damageTaken[key] *= 1 - value(type);
    }
    for (const [type, key] of Object.entries(VULNERABILITY_TYPES)) {
        effects.damageTaken[key] *= 1 + value(type);
    }

    return effects;
}
