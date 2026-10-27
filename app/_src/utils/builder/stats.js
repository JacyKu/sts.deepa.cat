import Percentage from './percentage';

const types = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];

// Delve infusions (from https://monumenta.wiki.gg/wiki/Delve_Infusions and
// com.playmonumenta.plugins.itemstats.infusions.*). Each selected infusion uses
// its own level (I-IV); Revelation adds one level to it, capped at V. Per-level
// values:
const DELVE_GEAR_DAMAGE_PCT_PER_LEVEL = {
    Vengeful: 2,
    Execution: 1.5,
    Fervor: 1.5,
    Choler: 1,
    Celestial: 1.5,
};
const DELVE_ATTACK_SPEED_PER_LEVEL = 0.015; // Grace
const DELVE_HEALING_PER_LEVEL = 0.015; // Nutriment
const DELVE_REGEN_PER_LEVEL = 0.04; // Soothing
const DELVE_KB_PER_LEVEL = 0.8; // Unyielding (0.08 attribute per level, in builder raw units where 1 raw = 10%)
const DELVE_COOLDOWN_PER_LEVEL = 0.01; // Epoch
const DELVE_EXPEDITE_SPEED_PER_LEVEL = 0.0075; // Expedite (3 stacks)
const DELVE_ARDOR_SPEED_PER_LEVEL = 0.02; // Ardor
const DELVE_CARAPACE_DR_PER_LEVEL = 0.0125; // Carapace
const DELVE_FUELED_DR_PER_LEVEL = 0.003; // Fueled (4 mobs)
const DELVE_ORBITAL_DR_PER_LEVEL = 0.015; // Orbital (scalable types)
const DELVE_PENNATE_FALL_PER_LEVEL = 0.05; // Pennate (fall only)
const DELVE_DECAPITATION_PER_LEVEL = 0.0125; // Decapitation (melee crit damage)

// Stack/uptime situationals. The enchant levels come from the gear; how much of
// them applies depends on how many stacks are up (Scorch, Stamina) or where in
// its window the moment sits (Reflexes, Tempo). The percentages that differ per
// region (the 20/25/30% EHP scaling) stay in situationalEHPScaling below - these
// four values are the same in every region.
const SCORCH_DMG_PER_STACK = 0.03; // Scorch: +3% Inferno tick damage per stack
const SCORCH_MAX_STACKS = 15;
const STAMINA_MAX_STACKS = 4; // (level * 2.5)% per stack, (level * 10)% at 4
const REFLEXES_FULL_SECONDS = 0.65; // full effect for 0.65s after a hit
const REFLEXES_HALF_SECONDS = 1.0; // then half effect for another 0.35s
const TEMPO_FULL_SECONDS = 4; // full after 4s without taking damage
const TEMPO_HALF_SECONDS = 2.5; // half from 2.5s

// A numeric form field, clamped, with a fallback for missing or unparsable
// input (older links, hand-edited tokens).
function clampStat(value, min, max, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

class Stats {
    constructor(
        itemData,
        formData,
        enabledBoxes,
        extraStats,
        enabledClassAbilityBuffs,
        buffEffects,
        skillEffects = null,
        potionEffects = null
    ) {
        this.region = Number(formData.region);
        if (![1, 2, 3].includes(this.region)) this.region = 3; // guard against non-numeric/absent region (e.g. legacy 'cz'/'dd' links) -LC
        // The defaults reproduce the behaviour before these inputs existed: full
        // stacks for Stamina, full uptime for Tempo, just-triggered Reflexes and
        // no Scorch.
        this.scorchStacks = clampStat(formData.scorchStacks, 0, SCORCH_MAX_STACKS, 0);
        this.staminaStacks = clampStat(formData.staminaStacks, 0, STAMINA_MAX_STACKS, STAMINA_MAX_STACKS);
        this.tempoSeconds = clampStat(formData.tempoSeconds, 0, Infinity, TEMPO_FULL_SECONDS);
        this.reflexesSeconds = clampStat(formData.reflexesSeconds, 0, Infinity, 0);
        this.enabledBoxes = enabledBoxes;
        this.enabledClassAbilityBuffs = enabledClassAbilityBuffs;
        // Potion/food buffs and the enabled skill/spec calculations, combined
        // (null when none apply). Preview-only, not part of the saved build.
        this.buffEffects = buffEffects || null;
        // Skill/spec damage is ability damage: it multiplies the gear damage
        // pools instead of joining the additive gear percentages. Potion
        // damage remains part of the gear percentage pools.
        this.skillEffects = skillEffects || null;
        this.potionEffects = potionEffects || buffEffects || null;
        this.itemNames = {
            mainhand: formData.mainhand,
            offhand: formData.offhand,
            helmet: formData.helmet,
            chestplate: formData.chestplate,
            leggings: formData.leggings,
            boots: formData.boots,
        };

        // The exact value behind every rounded display stat, filled in by the
        // round helpers below. The UI renders the 2 dp value and shows the
        // full one in the hover tooltip; calculations always use the exact
        // value (the rounded fields are never read back).
        this.fullValues = {};

        this.fullItemData = {};
        types.forEach((type) => {
            this.fullItemData[type] =
                this.itemNames[type] != 'None'
                    ? itemData[this.itemNames[type]]
                        ? itemData[this.itemNames[type]]
                        : { masterwork: 0 }
                    : { masterwork: 0 };
        });

        this.itemStats = {};
        types.forEach((type) => {
            this.itemStats[type] =
                this.itemNames[type] != 'None'
                    ? itemData[this.itemNames[type]]
                        ? itemData[this.itemNames[type]].stats
                        : undefined
                    : undefined;
        });

        // Delve infusions, read from the hidden delveInfusion-<slot> and
        // delveLevel-<slot> form fields. Levels are per item (I-IV); Revelation
        // adds one level to every selected infusion, capped at V. The builder's
        // "Delve Infusions" toggle (delveEnabled) turns every delve effect off
        // without dropping the picks; both flags default to on for consumers
        // that don't carry them (saved builds, compare page).
        const delveEnabled = formData.delveEnabled !== '0';
        const infusionsEnabled = formData.infusionsEnabled !== '0';
        const revelationBonus = formData.revelation === '1' ? 1 : 0;
        this.delveInfusions = {};
        this.delveInfusionLevels = {};
        types.forEach((type) => {
            const name = formData[`delveInfusion-${type}`];
            if (name && name !== 'None') {
                this.delveInfusions[type] = name;
                const rawLevel = Number(formData[`delveLevel-${type}`]);
                const baseLevel = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.min(5, Math.floor(rawLevel)) : 4;
                const level = Math.min(5, baseLevel + revelationBonus);
                this.delveInfusionLevels[name] = Math.max(this.delveInfusionLevels[name] || 0, level);
            }
        });
        this.delveInfusionNames = Object.values(this.delveInfusions);
        this.getDelveLevel = (name) => this.delveInfusionLevels[name] || 0;
        // An infusion's stat effect only counts while its situational checkbox
        // is ticked (mirrors the infusion's in-game condition).
        this.hasDelveInfusion = (name) =>
            delveEnabled &&
            this.delveInfusionNames.includes(name) &&
            Boolean(this.enabledBoxes && this.enabledBoxes[name.toLowerCase()]);

        this.situationals = {
            shielding: { enabled: enabledBoxes.shielding, level: 0 },
            poise: { enabled: enabledBoxes.poise, level: 0 },
            inure: { enabled: enabledBoxes.inure, level: 0 },
            steadfast: { enabled: enabledBoxes.steadfast, level: 0 },
            guard: { enabled: enabledBoxes.guard, level: 0 },
            second_wind: { enabled: enabledBoxes.second_wind, level: 0 },
            ethereal: { enabled: enabledBoxes.ethereal, level: 0 },
            reflexes: { enabled: enabledBoxes.reflexes, level: 0 },
            evasion: { enabled: enabledBoxes.evasion, level: 0 },
            tempo: { enabled: enabledBoxes.tempo, level: 0 },
            cloaked: { enabled: enabledBoxes.cloaked, level: 0 },
            earth_aspect: { enabled: enabledBoxes.earth_aspect, level: 0 },

            smite: { enabled: enabledBoxes.smite, level: 0 },
            duelist: { enabled: enabledBoxes.duelist, level: 0 },
            slayer: { enabled: enabledBoxes.slayer, level: 0 },
            point_blank: { enabled: enabledBoxes.point_blank, level: 0 },
            sniper: { enabled: enabledBoxes.sniper, level: 0 },
            first_strike: { enabled: enabledBoxes.first_strike, level: 0 },
            momentum: { enabled: enabledBoxes.momentum, level: 0 },
            regicide: { enabled: enabledBoxes.regicide, level: 0 },
            trivium: { enabled: enabledBoxes.trivium, level: 0 },
            stamina: { enabled: enabledBoxes.stamina, level: 0 },
            technique: { enabled: enabledBoxes.technique, level: 0 },
            abyssal: { enabled: enabledBoxes.abyssal, level: 0 },
            fractal: { enabled: enabledBoxes.fractal, level: 0 },
            skyseeker: { enabled: enabledBoxes.skyseeker, level: 0 },
            backstab: { enabled: enabledBoxes.backstab, level: 0 },
            curse_of_the_veil: { enabled: enabledBoxes.curse_of_the_veil, level: 0 },

            // fake entries to never throw errors, none of these are real enchantments
            retaliation_normal: { enabled: enabledBoxes.retaliation_normal, level: 0 },
            retaliation_elite: { enabled: enabledBoxes.retaliation_elite, level: 0 },
            retaliation_boss: { enabled: enabledBoxes.retaliation_boss, level: 0 },

            adaptability: { enabled: true, level: 0 },
        };

        this.tenacity = infusionsEnabled && formData.tenacity ? formData.tenacity : 0;
        this.vitality = infusionsEnabled && formData.vitality ? formData.vitality : 0;
        this.vigor = infusionsEnabled && formData.vigor ? formData.vigor : 0;
        this.focus = infusionsEnabled && formData.focus ? formData.focus : 0;
        this.perspicacity = infusionsEnabled && formData.perspicacity ? formData.perspicacity : 0;

        // Understanding (delve infusion): every non-Delve infusion each item
        // carries gains (0.2 * level) levels. The per-type item counts come
        // from the builder's basic infusion selections; like the other delve
        // infusions, the situational chip decides whether it is counted.
        if (infusionsEnabled && this.hasDelveInfusion('Understanding') && formData.basicInfusionCounts) {
            let counts = null;
            try {
                counts = JSON.parse(formData.basicInfusionCounts);
            } catch (e) {
                counts = null;
            }
            if (counts) {
                const bonus = 0.2 * this.getDelveLevel('Understanding');
                for (const key of ['tenacity', 'vitality', 'vigor', 'focus', 'perspicacity']) {
                    const items = Number(counts[key]) || 0;
                    if (items > 0) this[key] = Number(this[key] || 0) + bonus * items;
                }
            }
        }

        this.currentHealthPercent = formData.health
            ? new Percentage(Math.max(1, Number(formData.health)))
            : new Percentage(100);
        this.situationalCap = [20, 30, 36][this.region - 1];
        this.situationalEHPScaling = [0.2, 0.25, 0.3][this.region - 1];
        this.damageInfusionsMultiplier = 0.75 + 0.25 * this.region;

        this.extraDamageMultiplier = 1;
        this.extraResistanceMultiplier = new Percentage(100);
        this.extraHealthMultiplier = 1;
        this.extraAttackSpeedMultiplier = 1;
        this.extraSpeedMultiplier = 1;
        if (extraStats) {
            if (extraStats.damageMultipliers) {
                this.extraDamageMultiplier = extraStats.damageMultipliers
                    .map((percObject) => percObject.val)
                    .reduce((accumulator, val) => accumulator * val, 1);
            }
            if (extraStats.resistanceMultipliers) {
                extraStats.resistanceMultipliers
                    .map((percObject) => percObject.val)
                    .forEach((val) => this.extraResistanceMultiplier.preciseMul(2 - val, false));
            }
            if (extraStats.healthMultipliers) {
                this.extraHealthMultiplier = extraStats.healthMultipliers
                    .map((percObject) => percObject.val)
                    .reduce((accumulator, val) => accumulator * val, 1);
            }
            if (extraStats.attackSpeedMultipliers) {
                this.extraAttackSpeedMultiplier = extraStats.attackSpeedMultipliers
                    .map((percObject) => percObject.val)
                    .reduce((accumulator, val) => accumulator * val, 1);
            }
            if (extraStats.speedMultipliers) {
                this.extraSpeedMultiplier = extraStats.speedMultipliers
                    .map((percObject) => percObject.val)
                    .reduce((accumulator, val) => accumulator * val, 1);
            }
        }

        // Grace: MULTIPLY_SCALAR_1 on the attack speed attribute (1.5% per level).
        if (this.hasDelveInfusion('Grace'))
            this.extraAttackSpeedMultiplier *= 1 + DELVE_ATTACK_SPEED_PER_LEVEL * this.getDelveLevel('Grace');

        this.setDefaultValues();
        this.sumAllStats();
        this.adjustStats();
        this.calculateDefenseStats();
        this.calculateOffenseStats();

        // Round HP to 2 decimals so floating-point precision errors don't leak
        // into displayed values; the exact value stays in fullValues for the
        // hover tooltips.
        this.healthFinal = this.roundNumber('healthFinal', this.healthFinal);
        this.currentHealth = this.roundNumber('currentHealth', this.currentHealth);
    }

    // ---------------------------------------------------------------------
    // Display rounding. Calculations run at full precision; every stat that
    // is rendered keeps its exact value in fullValues (used by the UI's hover
    // tooltips) and its 2 dp value in the stat field (used by the cards).
    // ---------------------------------------------------------------------

    /** 2 dp string for a numeric stat (keeps trailing zeros, e.g. "0.00"). */
    round(name, value) {
        const num = Number(value);
        this.fullValues[name] = num;
        return num.toFixed(2);
    }

    /** 2 dp percentage string for a Percentage stat. */
    roundPerc(name, percentage) {
        this.fullValues[name] = percentage.perc;
        return percentage.toFixedPerc(2);
    }

    /** Number rounded to 2 dp (no trailing zeros, e.g. for max/current HP). */
    roundNumber(name, value) {
        const num = Number(value);
        this.fullValues[name] = num;
        return Number(num.toFixed(2));
    }

    calculateOffenseStats() {
        // as of additive, "class damage" is a separate category for damage that is added together and then multiplied by gear damage
        // flat damage is added after all multipliers are calculated
        let flatAttackDamage = 0;
        // damage situationals

        let firstStrikeSit = this.situationals.first_strike.enabled ? 10 * this.situationals.first_strike.level : 0;
        // Momentum: (level * 10)% damage on the next hit while sprinting.
        let momentumSit = this.situationals.momentum.enabled ? 10 * this.situationals.momentum.level : 0;
        let regicideSit = this.situationals.regicide.enabled ? 10 * this.situationals.regicide.level : 0;
        let triviumSit = this.situationals.trivium.enabled ? 10 * this.situationals.trivium.level : 0;
        let staminaSit = this.situationals.stamina.enabled
            ? 10 * this.situationals.stamina.level * (this.staminaStacks / STAMINA_MAX_STACKS)
            : 0;
        let techniqueSit = this.situationals.technique.enabled ? 10 * this.situationals.technique.level : 0;
        let abyssalSit = this.situationals.abyssal.enabled ? 10 * this.situationals.abyssal.level : 0;
        let fractalSit = this.situationals.fractal.enabled ? 10 * this.situationals.fractal.level : 0;
        let skyseekerSit = this.situationals.skyseeker.enabled ? 10 * this.situationals.skyseeker.level : 0;
        let backstabSit = this.situationals.backstab.enabled ? 15 * this.situationals.backstab.level : 0;
        let retaliationSit = this.situationals.retaliation_boss.enabled
            ? 65
            : this.situationals.retaliation_elite.enabled
              ? 50
              : this.situationals.retaliation_normal.enabled
                ? 35
                : 0;

        if (this.enabledClassAbilityBuffs.celestial_blessing) {
            let bonus = this.enabledClassAbilityBuffs.celestial_blessing_lv2 ? 30 : 20;
            bonus += Number(this.buffEffects && this.buffEffects.classAllDamagePercent) || 0;
            this.classAttackDamagePercent.add(bonus);
            this.classProjectileDamagePercent.add(bonus);
            this.classMagicDamagePercent.add(bonus);
        }
        // Melee Stats

        // base damage
        let attackDamageBase = this.sumNumberStat(this.itemStats.mainhand, 'attack_damage_base', this.attackDamage);
        ['smite', 'duelist', 'slayer'].forEach((specialist) => {
            if (this.enabledBoxes[specialist])
                attackDamageBase += this.sumEnchantmentStat(this.itemStats.mainhand, specialist, 2);
        });
        attackDamageBase += Number(this.buffEffects && this.buffEffects.flatMeleeDamage) || 0;

        // gear damage
        this.attackDamagePercent.add(this.damageInfusionsMultiplier * Number(this.vigor));
        this.attackDamagePercent.add(firstStrikeSit);
        this.attackDamagePercent.add(momentumSit);
        this.attackDamagePercent.add(regicideSit);
        this.attackDamagePercent.add(staminaSit);
        this.attackDamagePercent.add(abyssalSit);
        this.attackDamagePercent.add(skyseekerSit);
        this.attackDamagePercent.add(backstabSit);
        this.attackDamagePercent.add(retaliationSit);
        this.attackDamagePercent.add(this.getDelveGearDamagePct());

        // Weapon Mastery is ability damage, so it belongs in the class pool.
        if (this.enabledClassAbilityBuffs.weapon_mastery) {
            const mainhand = this.fullItemData.mainhand || {};
            const lv2 = this.enabledClassAbilityBuffs.weapon_mastery_lv2;
            const enhanced = this.enabledClassAbilityBuffs.weapon_mastery_enhancement;
            if (mainhand.type == 'Axe') {
                this.classAttackDamagePercent.add((lv2 ? 10 : 5) + (enhanced ? 10 : 0));
            } else if (mainhand.base_item?.match(/Sword/i)) {
                // sword wands are still swords but count as wands in item type -LC
                this.classAttackDamagePercent.add((lv2 ? 10 : 0) + (enhanced ? 10 : 0));
            }
        }
        if (this.enabledClassAbilityBuffs.versatile) {
            this.classAttackDamagePercent.add((this.projectileDamagePercent.perc - 100) * 0.5);
        }
        if (
            (this.enabledClassAbilityBuffs.dethroner_boss || this.enabledClassAbilityBuffs.dethroner_elite) &&
            this.fullItemData.mainhand.base_item?.match(/Sword/i) &&
            this.fullItemData.offhand.type == 'Offhand Sword'
        ) {
            this.classAttackDamagePercent.add(this.enabledClassAbilityBuffs.dethroner_boss ? 15 : 30); // boss takes priority
        }

        // channeling is a dumb passive, for the record
        if (this.enabledClassAbilityBuffs.channeling) {
            this.classAttackDamagePercent.add(20);
        }

        // flat damage
        // im absolutely not adding the ice aspect flat damage for blazes lmao
        if (this.enabledClassAbilityBuffs.weapon_mastery) {
            const mainhand = this.fullItemData.mainhand || {};
            const lv2 = this.enabledClassAbilityBuffs.weapon_mastery_lv2;
            if (mainhand.type == 'Axe') {
                flatAttackDamage += lv2 ? 4 : 2;
            } else if (mainhand.base_item?.match(/Sword/i)) {
                flatAttackDamage += lv2 ? 1 : 0;
            }
        }

        // final damage
        let attackDamage =
            attackDamageBase *
            this.attackDamagePercent.val *
            (this.currentHealthPercent.perc <= 50 ? 1 - 0.1 * this.crippling : 1) *
            this.classAttackDamagePercent.val *
            this.extraDamageMultiplier;
        let attackDamageCrit = this.cumbersome ? attackDamage : attackDamage * 1.5;
        attackDamage += flatAttackDamage;
        attackDamageCrit += flatAttackDamage; // this is not a bug, flat damage is added after the crit multiplier
        // Decapitation (delve infusion): melee critical strikes deal
        // (1.25% * level) more damage. Counted while its situational chip is
        // ticked, like the other infusions.
        if (this.hasDelveInfusion('Decapitation'))
            attackDamageCrit *= 1 + DELVE_DECAPITATION_PER_LEVEL * this.getDelveLevel('Decapitation');
        // Skill calculations that add flat damage to critical hits (By My
        // Blade).
        attackDamageCrit += Number(this.buffEffects && this.buffEffects.critFlatDamage) || 0;

        // attack speed (computed in adjustStats, where Life Drain needs it)
        let attackSpeed = this.weaponAttackSpeed;
        let attackCritSpeed = Math.min(attackSpeed, 5 / 3);

        // Projectile Stats

        // base damage
        let projectileDamageBase = this.sumNumberStat(
            this.itemStats.mainhand,
            'projectile_damage_base',
            this.projectileDamage
        );
        ['point_blank', 'sniper'].forEach((specialist) => {
            if (this.enabledBoxes[specialist])
                projectileDamageBase += this.sumEnchantmentStat(this.itemStats.mainhand, specialist, 2);
        });

        // gear damage
        this.projectileDamagePercent.add(this.damageInfusionsMultiplier * Number(this.focus));
        this.projectileDamagePercent.add(firstStrikeSit); // proj fstrike is 10%*level as of june balance
        this.projectileDamagePercent.add(regicideSit);
        this.projectileDamagePercent.add(staminaSit);
        this.projectileDamagePercent.add(techniqueSit); // proj technique is 10%*level
        this.projectileDamagePercent.add(abyssalSit);
        this.projectileDamagePercent.add(skyseekerSit);
        this.projectileDamagePercent.add(retaliationSit * 0.5);
        this.projectileDamagePercent.add(this.getDelveGearDamagePct());

        // class damage
        if (this.enabledClassAbilityBuffs.versatile) {
            this.classProjectileDamagePercent.add((this.attackDamagePercent.perc - 100) * 0.4);
        }

        // flat damage
        // does projectile even have any?

        // misc
        let projectileSpeed =
            this.sumNumberStat(this.itemStats.mainhand, 'projectile_speed_base', this.projectileSpeed) *
            this.projectileSpeedPercent.val;
        let throwRate =
            this.sumNumberStat(this.itemStats.mainhand, 'throw_rate_base', this.throwRate) * this.throwRatePercent.val;

        // final damage
        let projectileDamage =
            projectileDamageBase *
            this.projectileDamagePercent.val *
            this.classProjectileDamagePercent.val *
            this.extraDamageMultiplier;

        // Magic Stats

        // base damage
        this.spellPowerPercent.add(this.sumNumberStat(this.itemStats.mainhand, 'spell_power_base', 0));
        let potionDamageBase = this.sumNumberStat(this.itemStats.mainhand, 'potion_damage_flat', 0);

        // gear damage
        this.magicDamagePercent.add(this.damageInfusionsMultiplier * Number(this.perspicacity));
        this.magicDamagePercent.add(regicideSit);
        this.magicDamagePercent.add(triviumSit);
        this.magicDamagePercent.add(techniqueSit);
        this.magicDamagePercent.add(abyssalSit);
        this.magicDamagePercent.add(fractalSit);
        this.magicDamagePercent.add(skyseekerSit);
        this.magicDamagePercent.add(retaliationSit * 0.5);
        this.magicDamagePercent.add(this.getDelveGearDamagePct());
        if (this.fullItemData.mainhand?.stats?.alchemical_utensil) {
            this.magicDamagePercent.add(firstStrikeSit);
        }

        // damage (normal magic damage); Taboo is ability damage.
        if (this.enabledClassAbilityBuffs.taboo_lv2) {
            this.classMagicDamagePercent.add(this.enabledClassAbilityBuffs.taboo_burst ? 80 : 40);
        } else if (this.enabledClassAbilityBuffs.taboo_lv1) {
            this.classMagicDamagePercent.add(30);
        }

        // flat damage

        // misc
        this.spellCooldownPercent = this.spellCooldownPercent.mul(Math.pow(0.95, this.aptitude), false);
        this.spellCooldownPercent = this.spellCooldownPercent.mul(Math.pow(1.05, this.ineptitude), false);
        // Epoch: class ability cooldowns reduced by 1% per level.
        if (this.hasDelveInfusion('Epoch'))
            this.spellCooldownPercent.mul(1 - DELVE_COOLDOWN_PER_LEVEL * this.getDelveLevel('Epoch'), false);
        // Potion cooldown buffs scale the same multiplier (a negative value is
        // a cooldown increase).
        if (this.buffEffects && this.buffEffects.cooldownReduction) {
            this.spellCooldownPercent.mul(1 - this.buffEffects.cooldownReduction, false);
        }

        // final damage
        let magicMultiplier =
            this.magicDamagePercent.val * this.classMagicDamagePercent.val * this.extraDamageMultiplier;
        this.spellDamage = this.spellPowerPercent.duplicate().mul(magicMultiplier, false);
        this.potionDamage = potionDamageBase * magicMultiplier;

        // display
        this.attackSpeedPercent = this.roundPerc('attackSpeedPercent', this.attackSpeedPercent);
        this.attackSpeed = this.round('attackSpeed', attackSpeed);
        this.attackDamagePercent = this.roundPerc('attackDamagePercent', this.attackDamagePercent);
        this.classAttackDamagePercent = this.roundPerc('classAttackDamagePercent', this.classAttackDamagePercent);
        this.attackDamage = this.round('attackDamage', attackDamage);
        this.attackDamageCrit = this.round('attackDamageCrit', attackDamageCrit);
        this.iframeDPS = this.round('iframeDPS', attackSpeed >= 2 ? attackDamage * 2 : attackDamage * attackSpeed);
        this.iframeCritDPS = this.round(
            'iframeCritDPS',
            attackSpeed >= 2 ? attackDamageCrit * 2 : attackDamageCrit * attackSpeed
        );
        this.critSpamDPS = this.round('critSpamDPS', attackCritSpeed * attackDamageCrit);

        this.projectileDamagePercent = this.roundPerc('projectileDamagePercent', this.projectileDamagePercent);
        this.classProjectileDamagePercent = this.roundPerc(
            'classProjectileDamagePercent',
            this.classProjectileDamagePercent
        );
        this.projectileDamage = this.round('projectileDamage', projectileDamage);
        this.projectileSpeedPercent = this.roundPerc('projectileSpeedPercent', this.projectileSpeedPercent);
        this.projectileSpeed = this.round('projectileSpeed', projectileSpeed);
        this.throwRatePercent = this.roundPerc('throwRatePercent', this.throwRatePercent);
        this.throwRate = this.round('throwRate', throwRate);

        this.magicDamagePercent = this.roundPerc('magicDamagePercent', this.magicDamagePercent);
        this.classMagicDamagePercent = this.roundPerc('classMagicDamagePercent', this.classMagicDamagePercent);
        this.spellPowerPercent = this.roundPerc('spellPowerPercent', this.spellPowerPercent);
        this.spellDamage = this.roundPerc('spellDamage', this.spellDamage);
        this.spellCooldownPercent = this.roundPerc('spellCooldownPercent', this.spellCooldownPercent);
        this.potionDamage = this.round('potionDamage', this.potionDamage);
    }

    calculateDefenseStats() {
        let drs = this.calculateDamageReductions();

        // Select to show either the regular dr, or dr with second wind currently active based on hp remaining
        let drType = this.situationals.second_wind.enabled ? 'secondwind' : 'base';

        // Regular Damage Reductions
        this.meleeDR = this.roundPerc('meleeDR', drs.melee[drType]);
        this.projectileDR = this.roundPerc('projectileDR', drs.projectile[drType]);
        this.magicDR = this.roundPerc('magicDR', drs.magic[drType]);
        this.blastDR = this.roundPerc('blastDR', drs.blast[drType]);
        this.fireDR = this.roundPerc('fireDR', drs.fire[drType]);
        this.fallDR = this.roundPerc('fallDR', drs.fall[drType]);
        this.ailmentDR = this.roundPerc('ailmentDR', drs.ailment[drType]);

        // Effective HP
        if (this.situationals.second_wind.level == 0 || drType == 'base') {
            const hp = this.healthFinal * this.currentHealthPercent.val;
            this.meleeEHP = this.round('meleeEHP', hp / (1 - drs.melee.base.val));
            this.projectileEHP = this.round('projectileEHP', hp / (1 - drs.projectile.base.val));
            this.magicEHP = this.round('magicEHP', hp / (1 - drs.magic.base.val));
            this.blastEHP = this.round('blastEHP', hp / (1 - drs.blast.base.val));
            this.fireEHP = this.round('fireEHP', hp / (1 - drs.fire.base.val));
            this.fallEHP = this.round('fallEHP', hp / (1 - drs.fall.base.val));
            this.ailmentEHP = this.round('ailmentEHP', hp / (1 - drs.ailment.base.val));
        } else {
            const hpNoSecondWind = Math.max(0, this.currentHealth - this.healthFinal * 0.5);
            const hpSecondWind = Math.min(this.currentHealth, this.healthFinal * 0.5);
            this.meleeEHP = this.round(
                'meleeEHP',
                hpNoSecondWind / (1 - drs.melee.base.val) + hpSecondWind / (1 - drs.melee.secondwind.val)
            );
            this.projectileEHP = this.round(
                'projectileEHP',
                hpNoSecondWind / (1 - drs.projectile.base.val) + hpSecondWind / (1 - drs.projectile.secondwind.val)
            );
            this.magicEHP = this.round(
                'magicEHP',
                hpNoSecondWind / (1 - drs.magic.base.val) + hpSecondWind / (1 - drs.magic.secondwind.val)
            );
            this.blastEHP = this.round(
                'blastEHP',
                hpNoSecondWind / (1 - drs.blast.base.val) + hpSecondWind / (1 - drs.blast.secondwind.val)
            );
            this.fireEHP = this.round(
                'fireEHP',
                hpNoSecondWind / (1 - drs.fire.base.val) + hpSecondWind / (1 - drs.fire.secondwind.val)
            );
            this.fallEHP = this.round(
                'fallEHP',
                hpNoSecondWind / (1 - drs.fall.base.val) + hpSecondWind / (1 - drs.fall.secondwind.val)
            );
            this.ailmentEHP = this.round(
                'ailmentEHP',
                hpNoSecondWind / (1 - drs.ailment.base.val) + hpSecondWind / (1 - drs.ailment.secondwind.val)
            );
        }

        // Effective HP regenerated per second: the raw (pre-mitigation) damage
        // that your regeneration can out-heal each second, per damage type.
        // Built from the exact (unrounded) regeneration; negative regeneration
        // (Curse of the Veil, Taboo burst) is clamped so the card never shows
        // below zero; it reads 0 without any regen.
        const regenPerSec = Math.max(0, this.regenPerSecFull || 0);
        this.meleeEHPR = this.round('meleeEHPR', regenPerSec / (1 - drs.melee[drType].val));
        this.projectileEHPR = this.round('projectileEHPR', regenPerSec / (1 - drs.projectile[drType].val));
        this.magicEHPR = this.round('magicEHPR', regenPerSec / (1 - drs.magic[drType].val));
        this.blastEHPR = this.round('blastEHPR', regenPerSec / (1 - drs.blast[drType].val));
        this.fireEHPR = this.round('fireEHPR', regenPerSec / (1 - drs.fire[drType].val));
        this.fallEHPR = this.round('fallEHPR', regenPerSec / (1 - drs.fall[drType].val));
        this.ailmentEHPR = this.round('ailmentEHPR', regenPerSec / (1 - drs.ailment[drType].val));

        // Health Normalized Damage Reductions
        this.meleeHNDR = this.roundPerc(
            'meleeHNDR',
            new Percentage(1 - (1 - drs.melee[drType].val) / (this.healthFinal / 20), false)
        );
        this.projectileHNDR = this.roundPerc(
            'projectileHNDR',
            new Percentage(1 - (1 - drs.projectile[drType].val) / (this.healthFinal / 20), false)
        );
        this.magicHNDR = this.roundPerc(
            'magicHNDR',
            new Percentage(1 - (1 - drs.magic[drType].val) / (this.healthFinal / 20), false)
        );
        this.blastHNDR = this.roundPerc(
            'blastHNDR',
            new Percentage(1 - (1 - drs.blast[drType].val) / (this.healthFinal / 20), false)
        );
        this.fireHNDR = this.roundPerc(
            'fireHNDR',
            new Percentage(1 - (1 - drs.fire[drType].val) / (this.healthFinal / 20), false)
        );
        this.fallHNDR = this.roundPerc(
            'fallHNDR',
            new Percentage(1 - (1 - drs.fall[drType].val) / (this.healthFinal / 20), false)
        );
        this.ailmentHNDR = this.roundPerc(
            'ailmentHNDR',
            new Percentage(1 - (1 - drs.ailment[drType].val) / (this.healthFinal / 20), false)
        );
    }

    calculateDamageTaken(
        noArmor,
        prot,
        fragility,
        protmodifier,
        armor,
        agility,
        usesSituationals,
        delveMultiplier = 1,
        potionMultiplier = 1
    ) {
        let damageTaken = {};
        let worldlyProtDR = 0.025 * (this.region + 1);
        let worldlyProtMultiplier = 1 - this.worldlyProtection * worldlyProtDR;
        let bonusResistanceMultiplier = 1;
        let situationalResistanceMultiplier = 1;
        // bonus resistance is only used for class ability buffs right now -LC

        damageTaken.base = noArmor
            ? 100 * worldlyProtMultiplier * Math.pow(0.96, prot * protmodifier - fragility * protmodifier)
            : 100 *
              worldlyProtMultiplier *
              Math.pow(
                  0.96,
                  prot * protmodifier -
                      fragility * protmodifier +
                      armor +
                      agility -
                      (0.5 * armor * agility) / (armor + agility)
              );

        damageTaken.secondwind = noArmor
            ? 100 * worldlyProtMultiplier * Math.pow(0.96, prot * protmodifier - fragility * protmodifier)
            : 100 *
              worldlyProtMultiplier *
              Math.pow(
                  0.96,
                  prot * protmodifier -
                      fragility * protmodifier +
                      armor +
                      agility -
                      (0.5 * armor * agility) / (armor + agility)
              );
        damageTaken.secondwind *= Math.pow(0.9, this.situationals.second_wind.level);

        if (this.enabledClassAbilityBuffs.weapon_mastery && this.fullItemData.mainhand.base_item?.match(/Sword/i)) {
            bonusResistanceMultiplier *= 0.9;
        }

        if (this.enabledClassAbilityBuffs.culling && this.fullItemData.mainhand.type == 'Scythe') {
            bonusResistanceMultiplier *= 0.9;
        }

        if (this.enabledClassAbilityBuffs.totemic_empowerment) {
            bonusResistanceMultiplier *= 0.9;
        }

        if (this.situationals.earth_aspect.enabled) {
            bonusResistanceMultiplier *= 1 - 0.05 * this.situationals.earth_aspect.level;
        }

        // So... situational changes, huh? Fun!
        //
        // Situationals provide enough armor/agi to give additive ehp. The
        // formula for the amount of ehp added is:
        // [region value] * Math.min(1, [player's armor/agi]/[region situational cap]) * total levels of situationals
        // where [region value] is 20%/25%/30% for r1/2/3, and the situational cap is 20/30/36 for r1/2/3.
        // (Essentially, the math.min just means if armor >= situational cap, you get the full region value,
        // if your armor is half the situational cap, you get half the region value, etc.)
        // -LC

        if (usesSituationals) {
            let armorScaling = Math.min(armor / this.situationalCap, 1);
            let agilityScaling = Math.min(agility / this.situationalCap, 1);
            if (this.situationals.adaptability.level > 0) {
                armorScaling = Math.max(armorScaling, agilityScaling);
                agilityScaling = Math.max(armorScaling, agilityScaling);
            }
            armorScaling *= this.situationalEHPScaling;
            agilityScaling *= this.situationalEHPScaling;

            let etherealSit = this.situationals.ethereal.enabled
                ? agilityScaling * this.situationals.ethereal.level
                : 0;
            let tempoSit = this.situationals.tempo.enabled
                ? agilityScaling * this.situationals.tempo.level * this.tempoUptime()
                : 0;
            let evasionSit = this.situationals.evasion.enabled ? agilityScaling * this.situationals.evasion.level : 0;
            let reflexesSit = this.situationals.reflexes.enabled
                ? agilityScaling * this.situationals.reflexes.level * this.reflexesUptime()
                : 0;
            let cloakedSit = this.situationals.cloaked.enabled ? agilityScaling * this.situationals.cloaked.level : 0;
            let shieldingSit = this.situationals.shielding.enabled
                ? armorScaling * this.situationals.shielding.level
                : 0;
            let poiseSit = this.situationals.poise.enabled
                ? this.currentHealthPercent.val >= 0.9
                    ? armorScaling * this.situationals.poise.level
                    : 0
                : 0;
            let inureSit = this.situationals.inure.enabled ? armorScaling * this.situationals.inure.level : 0;
            let guardSit = this.situationals.guard.enabled ? armorScaling * this.situationals.guard.level : 0;

            let steadfastScaling = (1 - this.currentHealthPercent.val) / 0.6;
            if (steadfastScaling > 1) steadfastScaling = 1;
            else if (steadfastScaling < 0) steadfastScaling = 0;
            let steadfastSit = this.situationals.steadfast.enabled
                ? steadfastScaling * armorScaling * this.situationals.steadfast.level
                : 0;

            let sumArmorSits = shieldingSit + poiseSit + inureSit + guardSit + steadfastSit;
            let sumAgiSits = etherealSit + tempoSit + evasionSit + reflexesSit + cloakedSit;
            let sumSits = sumArmorSits + sumAgiSits;

            situationalResistanceMultiplier *= 1 / (1 + sumSits);
        }

        damageTaken.base =
            damageTaken.base *
            (1 - this.tenacity * 0.005) *
            this.extraResistanceMultiplier.val *
            bonusResistanceMultiplier *
            situationalResistanceMultiplier *
            delveMultiplier *
            potionMultiplier;

        damageTaken.secondwind =
            damageTaken.secondwind *
            (1 - this.tenacity * 0.005) *
            this.extraResistanceMultiplier.val *
            bonusResistanceMultiplier *
            situationalResistanceMultiplier *
            delveMultiplier *
            potionMultiplier;

        return damageTaken;
    }

    calculateDamageReductions() {
        /*
        Calculates all things damage reduction related.
        */

        // Prevents things like Auric Tiara from breaking the DR calculations
        // since having negative armor/agility doesn't mean you will take
        // additional damage from enemy attacks.
        let armor = this.armor < 0 ? 0 : this.armor;
        let agility = this.agility < 0 ? 0 : this.agility;

        let moreAgility = false;
        let moreArmor = false;
        let hasEqual = false;
        agility > armor ? (moreAgility = true) : armor > agility ? (moreArmor = true) : (hasEqual = true);
        let hasNothing = hasEqual && armor == 0;

        let halfArmor = armor / 2;
        let halfAgility = agility / 2;

        // Delve infusion damage reduction multipliers:
        // Carapace (all damage) and Fueled (all damage, capped at 4 afflicted mobs)
        // apply everywhere; Orbital applies to scalable types (everything except
        // fall/true/unscalable); Pennate only applies to fall damage.
        let delveCommonMultiplier = 1;
        if (this.hasDelveInfusion('Carapace'))
            delveCommonMultiplier *= 1 - DELVE_CARAPACE_DR_PER_LEVEL * this.getDelveLevel('Carapace');
        if (this.hasDelveInfusion('Fueled'))
            delveCommonMultiplier *= 1 - DELVE_FUELED_DR_PER_LEVEL * 4 * this.getDelveLevel('Fueled');
        const delveOrbitalMultiplier = this.hasDelveInfusion('Orbital')
            ? 1 - DELVE_ORBITAL_DR_PER_LEVEL * this.getDelveLevel('Orbital')
            : 1;
        const delvePennateMultiplier = this.hasDelveInfusion('Pennate')
            ? 1 - DELVE_PENNATE_FALL_PER_LEVEL * this.getDelveLevel('Pennate')
            : 1;

        // Potion/food resistances multiply the incoming damage of each type.
        const potionTaken = (type) =>
            this.buffEffects ? this.buffEffects.damageTaken.all * (this.buffEffects.damageTaken[type] ?? 1) : 1;

        let meleeDamage = this.calculateDamageTaken(
            hasNothing,
            this.meleeProt,
            this.meleeFragility,
            2,
            armor,
            agility,
            true,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('melee')
        );
        let projectileDamage = this.calculateDamageTaken(
            hasNothing,
            this.projectileProt,
            this.projectileFragility,
            2,
            armor,
            agility,
            true,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('projectile')
        );
        let magicDamage = this.calculateDamageTaken(
            hasNothing,
            this.magicProt,
            this.magicFragility,
            2,
            armor,
            agility,
            true,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('magic')
        );
        let blastDamage = this.calculateDamageTaken(
            hasNothing,
            this.blastProt,
            this.blastFragility,
            2,
            armor,
            agility,
            true,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('blast')
        );
        let fireDamage = this.calculateDamageTaken(
            hasNothing,
            this.fireProt,
            this.fireFragility,
            2,
            halfArmor,
            halfAgility,
            false,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('fire')
        );
        let fallDamage = this.calculateDamageTaken(
            hasNothing,
            this.fallProt,
            0,
            3,
            halfArmor,
            halfAgility,
            false,
            delveCommonMultiplier * delvePennateMultiplier,
            potionTaken('fall')
        );
        let ailmentDamage = this.calculateDamageTaken(
            true,
            0,
            0,
            0,
            0,
            0,
            false,
            delveCommonMultiplier * delveOrbitalMultiplier,
            potionTaken('ailment')
        );
        // Toughness: +20%/+40% ailment resistance.
        if (this.enabledClassAbilityBuffs.toughness_lv1) {
            const toughnessAilment = this.enabledClassAbilityBuffs.toughness_lv2 ? 0.4 : 0.2;
            ailmentDamage.base *= 1 - toughnessAilment;
            ailmentDamage.secondwind *= 1 - toughnessAilment;
        }

        let reductions = {
            melee: {
                base: new Percentage(100 - meleeDamage.base),
                secondwind: new Percentage(100 - meleeDamage.secondwind),
            },
            projectile: {
                base: new Percentage(100 - projectileDamage.base),
                secondwind: new Percentage(100 - projectileDamage.secondwind),
            },
            magic: {
                base: new Percentage(100 - magicDamage.base),
                secondwind: new Percentage(100 - magicDamage.secondwind),
            },
            blast: {
                base: new Percentage(100 - blastDamage.base),
                secondwind: new Percentage(100 - blastDamage.secondwind),
            },
            fire: {
                base: new Percentage(100 - fireDamage.base),
                secondwind: new Percentage(100 - fireDamage.secondwind),
            },
            fall: {
                base: new Percentage(100 - fallDamage.base),
                secondwind: new Percentage(100 - fallDamage.secondwind),
            },
            ailment: {
                base: new Percentage(100 - ailmentDamage.base),
                secondwind: new Percentage(100 - ailmentDamage.secondwind),
            },
        };

        return reductions;
    }

    sumNumberStat(itemStats, statName, defaultIncrement) {
        if (!itemStats) return 0;
        const value = itemStats[statName];
        if (value === undefined) {
            return defaultIncrement ? defaultIncrement : 0;
        }
        if (typeof value === 'object' && value !== null && 'value' in value) {
            return Number(value.value || 0);
        }
        return Number(value);
    }

    sumEnchantmentStat(itemStats, enchName, perLevelMultiplier) {
        if (!itemStats) return 0;
        const value = itemStats[enchName];
        if (value === undefined) {
            return 0;
        }
        if (typeof value === 'object' && value !== null && 'value' in value) {
            return Number(value.value || 0) * perLevelMultiplier;
        }
        return Number(value) * perLevelMultiplier;
    }

    getDelveGearDamagePct() {
        let total = 0;
        for (const name of this.delveInfusionNames) {
            if (!this.hasDelveInfusion(name)) continue;
            total += (DELVE_GEAR_DAMAGE_PCT_PER_LEVEL[name] || 0) * this.getDelveLevel(name);
        }
        return total;
    }

    adjustStats() {
        /*
        Minor calculations to adjust the stat values
        */
        // Nutriment: extra healing multiplier (1.5% per level).
        if (this.hasDelveInfusion('Nutriment'))
            this.healingRate.mul(1 + DELVE_HEALING_PER_LEVEL * this.getDelveLevel('Nutriment'), false);
        // Warrior Toughness: +10%/+20% max health, +5% more when enhanced.
        // It is a separate multiplicative source (like class damage), not part of the additive gear hp% pool.
        let toughnessMultiplier = 1;
        if (this.enabledClassAbilityBuffs.toughness_lv1) {
            let toughnessBonus = this.enabledClassAbilityBuffs.toughness_lv2 ? 20 : 10;
            if (this.enabledClassAbilityBuffs.toughness_enhancement) toughnessBonus += 5;
            toughnessBonus += Number(this.buffEffects && this.buffEffects.toughnessHealthPercent) || 0;
            toughnessMultiplier = 1 + toughnessBonus / 100;
        }
        // Calculate final health. Max health is hard-stopped at 1 point: flat
        // penalties can push the base towards zero, and multipliers would then
        // carry the result below the game's minimum, so clamp after the full
        // product rather than on any single factor.
        this.healthFinal = Math.max(
            1,
            this.healthFlat *
                this.healthPercent.val *
                (1 + 0.01 * Number(this.vitality)) *
                toughnessMultiplier *
                this.extraHealthMultiplier
        );
        // Current health (percentage of max health based on player input)
        this.currentHealth = this.healthFinal * this.currentHealthPercent.val;
        // Frenzy (Warrior): +30% attack speed (lv1), +40% attack speed and
        // +20% movement speed (lv2). The game applies it as a
        // MULTIPLY_SCALAR_1 attack speed modifier, so it multiplies gear and
        // potion attack speed instead of adding to it. The Enhancement adds
        // +20% melee damage.
        if (this.enabledClassAbilityBuffs.frenzy) {
            const lv2 = this.enabledClassAbilityBuffs.frenzy_lv2;
            // The Frenzy charm stat is part of the same MULTIPLY_SCALAR_1
            // modifier, so add it to the 30/40 before multiplying.
            const charmAttackSpeed = Number(this.buffEffects && this.buffEffects.attackSpeedPercent) || 0;
            this.attackSpeedPercent.mul(1 + ((lv2 ? 40 : 30) + charmAttackSpeed) / 100, false);
            if (lv2) {
                this.speedPercent.add(20 + (Number(this.buffEffects && this.buffEffects.frenzySpeedPercent) || 0));
            }
            if (this.enabledClassAbilityBuffs.frenzy_enhancement) {
                this.classAttackDamagePercent.add(
                    20 + (Number(this.buffEffects && this.buffEffects.frenzyBonusDamagePercent) || 0)
                );
            }
        }
        // Fix speed percentage to account for base speed
        this.speedPercent = this.roundPerc(
            'speedPercent',
            this.speedPercent
                .mul(this.speedFlat / 0.1, false)
                .mul(this.currentHealthPercent.perc <= 50 ? 1 - 0.1 * this.crippling : 1, false)
                .mul(this.enabledClassAbilityBuffs.totemic_empowerment ? 1.1 : 1, false)
                .mul(
                    this.enabledClassAbilityBuffs.weapon_mastery_enhancement && this.fullItemData.mainhand.type == 'Axe'
                        ? 1 + (15 + (Number(this.buffEffects && this.buffEffects.weaponMasterySpeedPercent) || 0)) / 100
                        : 1,
                    false
                )
                .mul(this.extraSpeedMultiplier, false)
                // Expedite: (0.75% * level * 3 stacks) movement speed while damaging with abilities.
                .mul(
                    this.hasDelveInfusion('Expedite')
                        ? 1 + DELVE_EXPEDITE_SPEED_PER_LEVEL * 3 * this.getDelveLevel('Expedite')
                        : 1,
                    false
                )
                // Ardor: (2% * level) speed after mining a spawner outside of water.
                .mul(
                    this.hasDelveInfusion('Ardor') ? 1 + DELVE_ARDOR_SPEED_PER_LEVEL * this.getDelveLevel('Ardor') : 1,
                    false
                )
        );

        // Fix knockback resistance to be percentage and cap at 100
        if (this.enabledClassAbilityBuffs.formidable) this.knockbackRes += 2;
        if (this.enabledClassAbilityBuffs.taboo) this.knockbackRes += 5;
        // Unyielding: additive (8% * level) knockback resistance.
        if (this.hasDelveInfusion('Unyielding'))
            this.knockbackRes += DELVE_KB_PER_LEVEL * this.getDelveLevel('Unyielding');
        this.knockbackRes = this.knockbackRes > 10 ? 100 : this.knockbackRes * 10;
        // Skill/spec calculations can scale healing (Spiritualism, Dark Pact).
        if (this.buffEffects && this.buffEffects.healingMultiplier !== 1) {
            this.healingRate.mul(this.buffEffects.healingMultiplier, false);
        }
        // Toughness Enhancement: +20% healing while below 50% HP.
        if (
            this.enabledClassAbilityBuffs.toughness_lv1 &&
            this.enabledClassAbilityBuffs.toughness_enhancement &&
            this.currentHealthPercent.perc <= 50
        ) {
            this.healingRate.mul(
                1 + (20 + (Number(this.buffEffects && this.buffEffects.toughnessHealingPercent) || 0)) / 100,
                false
            );
        }
        let effHealingNonRounded = new Percentage((20 / this.healthFinal) * this.healingRate.val, false);
        if (this.enabledClassAbilityBuffs.taboo) effHealingNonRounded.mul(50);
        this.effHealingRate = this.roundPerc('effHealingRate', effHealingNonRounded);
        let regenPerSecNonRounded = (1 / 3) * Math.sqrt(this.baseRegenLevel) * this.healingRate.val;
        // Curse of the Veil: drains level health every 3 seconds (level/3 per
        // second), but only while its situational checkbox is ticked (hostile
        // mob nearby / recently dealt damage).
        if (this.situationals.curse_of_the_veil.enabled) {
            regenPerSecNonRounded -= (1 / 3) * this.baseVeilcurseLevel;
        }
        if (this.enabledClassAbilityBuffs.taboo_burst) regenPerSecNonRounded -= 0.07 * this.healthFinal;
        // Soothing: regenerates (0.04 * level) health per second.
        if (this.hasDelveInfusion('Soothing'))
            regenPerSecNonRounded += DELVE_REGEN_PER_LEVEL * this.getDelveLevel('Soothing');
        // Rejuvenation (Cleric Seraph): heal 5% max HP every 3s while below 50% HP.
        if (
            this.currentHealthPercent.perc < 50 &&
            this.buffEffects &&
            this.buffEffects.lowHealthRegenPercent
        ) {
            // Healing received modifiers (AntiHeal / Heal potions, Dark Pact,
            // etc.) scale this heal like every other healing event.
            const healingMultiplier =
                this.buffEffects.healingMultiplier === undefined
                    ? 1
                    : Math.max(0, Number(this.buffEffects.healingMultiplier) || 0);
            regenPerSecNonRounded +=
                (Number(this.buffEffects.lowHealthRegenPercent) / 100) * this.healthFinal * healingMultiplier;
        }
        this.regenPerSec = this.round('regenPerSec', regenPerSecNonRounded);
        this.regenPerSecPercent = this.roundPerc(
            'regenPerSecPercent',
            new Percentage(regenPerSecNonRounded / this.healthFinal, false)
        );
        // The exact (unrounded) regeneration, used by the EHPR calculation.
        this.regenPerSecFull = regenPerSecNonRounded;
        // The weapon's attack speed in attacks per second, computed exactly as
        // calculateOffenseStats will (all of its inputs are ready by now).
        // Life Drain scales with it, so it is computed once here and reused.
        this.weaponAttackSpeed =
            (this.sumNumberStat(this.itemStats.mainhand, 'attack_speed_base', this.attackSpeed) +
                this.attackSpeedFlatBonus) *
            this.attackSpeedPercent.val *
            this.extraAttackSpeedMultiplier;
        // Life Drain (balance update): healed on crit is
        // 1.5 * sqrt(level) / attackSpeed^1.5, scaled by the healing rate.
        let lifeDrainOnCritFixedNonRounded =
            ((1.5 * Math.sqrt(this.lifeDrainOnCrit)) / Math.pow(this.weaponAttackSpeed, 1.5)) * this.healingRate.val;
        this.lifeDrainOnCrit = this.round('lifeDrainOnCrit', lifeDrainOnCritFixedNonRounded);
        this.healingRate = this.roundPerc('healingRate', this.healingRate);
        this.lifeDrainOnCritPercent = this.roundPerc(
            'lifeDrainOnCritPercent',
            new Percentage(lifeDrainOnCritFixedNonRounded / this.healthFinal, false)
        );
        this.thorns = this.round('thorns', this.thorns * this.thornsPercent.val);
    }

    sumAllStats() {
        /*
        Add up all the stats from the items
        */
        Object.keys(this.itemStats).forEach((type) => {
            let itemStats = this.itemStats[type];
            if (itemStats !== undefined) {
                this.healthPercent.add(this.sumNumberStat(itemStats, 'max_health_percent'));
                this.healthFlat += this.sumNumberStat(itemStats, 'max_health_flat');
                this.agility += this.sumNumberStat(itemStats, 'agility');
                this.armor += this.sumNumberStat(itemStats, 'armor');
                this.speedPercent.add(this.sumNumberStat(itemStats, 'speed_percent'));
                this.speedFlat += this.sumNumberStat(itemStats, 'speed_flat');
                this.knockbackRes += this.sumNumberStat(itemStats, 'knockback_resistance_flat');
                this.thorns += this.sumNumberStat(itemStats, 'thorns_flat');
                this.thornsPercent.add(this.sumNumberStat(itemStats, 'thorns_percent'));
                this.throwRatePercent.add(this.sumNumberStat(itemStats, 'throw_rate_percent'));
                this.infernoDmgPerTick += this.sumNumberStat(itemStats, 'inferno');

                this.healingRate
                    .add(this.sumEnchantmentStat(itemStats, 'curse_of_anemia', -10))
                    .add(this.sumEnchantmentStat(itemStats, 'sustenance', 10));
                this.baseRegenLevel += this.sumEnchantmentStat(itemStats, 'regeneration', 1);
                this.baseVeilcurseLevel += this.sumEnchantmentStat(itemStats, 'curse_of_the_veil', 1);
                this.lifeDrainOnCrit += this.sumEnchantmentStat(itemStats, 'life_drain', 1);

                this.meleeProt += this.sumNumberStat(itemStats, 'melee_protection');
                this.projectileProt += this.sumNumberStat(itemStats, 'projectile_protection');
                this.magicProt += this.sumNumberStat(itemStats, 'magic_protection');
                this.blastProt += this.sumNumberStat(itemStats, 'blast_protection');
                this.fireProt += this.sumNumberStat(itemStats, 'fire_protection');
                this.fallProt += this.sumNumberStat(itemStats, 'feather_falling');

                this.meleeFragility += this.sumNumberStat(itemStats, 'melee_fragility');
                this.projectileFragility += this.sumNumberStat(itemStats, 'projectile_fragility');
                this.magicFragility += this.sumNumberStat(itemStats, 'magic_fragility');
                this.blastFragility += this.sumNumberStat(itemStats, 'blast_fragility');
                this.fireFragility += this.sumNumberStat(itemStats, 'fire_fragility');

                this.attackDamagePercent.add(this.sumNumberStat(itemStats, 'attack_damage_percent'));
                this.attackSpeedPercent.add(this.sumNumberStat(itemStats, 'attack_speed_percent'));
                this.attackSpeedFlatBonus += this.sumNumberStat(itemStats, 'attack_speed_flat');

                this.projectileDamagePercent.add(this.sumNumberStat(itemStats, 'projectile_damage_percent'));
                this.projectileSpeedPercent.add(this.sumNumberStat(itemStats, 'projectile_speed_percent'));

                this.magicDamagePercent.add(this.sumNumberStat(itemStats, 'magic_damage_percent'));

                this.aptitude += this.sumEnchantmentStat(itemStats, 'aptitude', 1);
                this.ineptitude += this.sumEnchantmentStat(itemStats, 'ineptitude', 1);

                this.worldlyProtection += this.sumNumberStat(itemStats, 'worldly_protection');

                Object.keys(this.situationals).forEach((situ) => {
                    this.situationals[situ].level += this.sumNumberStat(itemStats, situ);
                });
                this.retaliation += this.sumNumberStat(itemStats, 'retaliation');

                this.crippling += this.sumNumberStat(itemStats, 'curse_of_crippling');
                this.corruption += this.sumNumberStat(itemStats, 'curse_of_corruption');
                this.instability += this.sumNumberStat(itemStats, 'curse_of_instability');
            }
        });

        // Potion/food buffs: additive with the gear percentages they mirror,
        // like the item stats above. Knockback resistance uses the same [0, 1]
        // attribute scale as items (multiplied by 10 for display later).
        if (this.buffEffects) {
            const buffs = this.buffEffects;
            this.healthPercent.add(buffs.healthPercent);
            this.speedPercent.add(buffs.speedPercent);
            this.attackSpeedPercent.add(buffs.attackSpeedPercent);
            this.knockbackRes += buffs.knockbackRes;
            this.baseRegenLevel += buffs.regenLevels;
        }
        if (this.potionEffects) {
            const potions = this.potionEffects;
            this.attackDamagePercent.add(potions.meleeDamagePercent);
            this.projectileDamagePercent.add(potions.projectileDamagePercent);
            this.magicDamagePercent.add(potions.magicDamagePercent);
        }
        // Skill/spec damage is ability damage, not gear damage. Add it to the
        // class damage pools so it multiplies the gear result in
        // calculateOffenseStats instead of increasing the gear percentage.
        if (this.skillEffects) {
            this.classAttackDamagePercent.add(this.skillEffects.meleeDamagePercent);
            this.classProjectileDamagePercent.add(this.skillEffects.projectileDamagePercent);
            this.classMagicDamagePercent.add(this.skillEffects.magicDamagePercent);
        }

        // Scorch: each stack makes each Inferno damage tick deal 3% more. Ticks
        // consume a stack, so this is the tick at the stack count entered. It
        // needs a build with Inferno (nothing is left to scale otherwise) and
        // its chip, like every other situational.
        if (this.enabledBoxes && this.enabledBoxes.scorch && this.infernoDmgPerTick > 0 && this.scorchStacks > 0) {
            this.infernoDmgPerTick *= 1 + SCORCH_DMG_PER_STACK * this.scorchStacks;
        }
    }

    // How much of the Reflexes bonus is up, given how long ago it triggered:
    // full for the first 0.65s, half from 0.65s through 1s, nothing after that.
    reflexesUptime() {
        if (this.reflexesSeconds < REFLEXES_FULL_SECONDS) return 1;
        if (this.reflexesSeconds <= REFLEXES_HALF_SECONDS) return 0.5;
        return 0;
    }

    // Tempo: full once 4s have passed without taking damage, half from 2.5s.
    tempoUptime() {
        if (this.tempoSeconds >= TEMPO_FULL_SECONDS) return 1;
        if (this.tempoSeconds >= TEMPO_HALF_SECONDS) return 0.5;
        return 0;
    }

    setDefaultValues() {
        ((this.agility = 0),
            (this.armor = 0),
            (this.speedPercent = new Percentage(100)),
            (this.speedFlat = 0.1),
            (this.knockbackRes = 0),
            (this.thorns = 0),
            (this.infernoDmgPerTick = 0),
            (this.thornsPercent = new Percentage(100)),
            (this.healthPercent = new Percentage(100)),
            (this.healthFlat = 20),
            (this.healthFinal = 20),
            (this.currentHealth = 20),
            (this.healingRate = new Percentage(100)),
            (this.effHealingRate = this.roundPerc('effHealingRate', new Percentage(100))),
            (this.baseRegenLevel = 0),
            (this.baseVeilcurseLevel = 0),
            (this.regenPerSecPercent = new Percentage(0)),
            (this.lifeDrainOnCrit = 0),
            (this.lifeDrainOnCritPercent = new Percentage(0)),
            (this.meleeProt = 0),
            (this.projectileProt = 0),
            (this.magicProt = 0),
            (this.blastProt = 0),
            (this.fireProt = 0),
            (this.fallProt = 0),
            (this.ailmentProt = 0),
            (this.meleeFragility = 0),
            (this.projectileFragility = 0),
            (this.magicFragility = 0),
            (this.blastFragility = 0),
            (this.fireFragility = 0),
            (this.meleeHNDR = this.roundPerc('meleeHNDR', new Percentage(0))),
            (this.projectileHNDR = this.roundPerc('projectileHNDR', new Percentage(0))),
            (this.magicHNDR = this.roundPerc('magicHNDR', new Percentage(0))),
            (this.blastHNDR = this.roundPerc('blastHNDR', new Percentage(0))),
            (this.fireHNDR = this.roundPerc('fireHNDR', new Percentage(0))),
            (this.fallHNDR = this.roundPerc('fallHNDR', new Percentage(0))),
            (this.ailmentHNDR = this.roundPerc('ailmentHNDR', new Percentage(0))),
            (this.meleeDR = this.roundPerc('meleeDR', new Percentage(0))),
            (this.projectileDR = this.roundPerc('projectileDR', new Percentage(0))),
            (this.magicDR = this.roundPerc('magicDR', new Percentage(0))),
            (this.blastDR = this.roundPerc('blastDR', new Percentage(0))),
            (this.fireDR = this.roundPerc('fireDR', new Percentage(0))),
            (this.fallDR = this.roundPerc('fallDR', new Percentage(0))),
            (this.ailmentDR = this.roundPerc('ailmentDR', new Percentage(0))),
            (this.meleeEHP = 0),
            (this.projectileEHP = 0),
            (this.magicEHP = 0),
            (this.blastEHP = 0),
            (this.fireEHP = 0),
            (this.fallEHP = 0),
            (this.ailmentEHP = 0),
            (this.meleeEHPR = 0),
            (this.projectileEHPR = 0),
            (this.magicEHPR = 0),
            (this.blastEHPR = 0),
            (this.fireEHPR = 0),
            (this.fallEHPR = 0),
            (this.ailmentEHPR = 0),
            (this.hasMoreArmor = false),
            (this.hasMoreAgility = false),
            (this.hasEqualDefenses = false),
            (this.worldlyProtection = 0));

        ((this.attackDamagePercent = new Percentage(100)),
            (this.attackSpeedPercent = new Percentage(100)),
            (this.attackSpeed = 4),
            (this.attackSpeedFlatBonus = 0),
            (this.attackDamage = 1),
            (this.attackDamageCrit = 1.5),
            (this.iframeDPS = 2),
            (this.iframeCritDPS = 3),
            (this.critSpamDPS = 2),
            (this.projectileDamagePercent = new Percentage(100)),
            (this.projectileDamage = 0),
            (this.projectileSpeedPercent = new Percentage(100)),
            (this.projectileSpeed = 0),
            (this.throwRatePercent = new Percentage(100)),
            (this.throwRate = 0),
            (this.magicDamagePercent = new Percentage(100)),
            (this.spellPowerPercent = new Percentage(100)),
            (this.spellDamage = new Percentage(100)),
            (this.spellCooldownPercent = new Percentage(100)),
            (this.potionDamage = 1),
            (this.classAttackDamagePercent = new Percentage(100)));
        this.classProjectileDamagePercent = new Percentage(100);
        this.classMagicDamagePercent = new Percentage(100);

        ((this.aptitude = 0),
            (this.ineptitude = 0),
            (this.crippling = 0),
            (this.corruption = 0),
            (this.retaliation = 0),
            (this.twoHanded = this.itemStats.mainhand && this.itemStats.mainhand['two_handed'] == 1 ? true : false));
        this.weightless = this.itemStats.offhand && this.itemStats.offhand['weightless'] == 1 ? true : false;
        this.cumbersome = this.itemStats.mainhand && this.itemStats.mainhand['cumbersome'] == 1 ? true : false;
        this.instability = 0;
    }
}

export default Stats;
