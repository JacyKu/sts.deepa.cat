export const CLASS_SKILL_CALCULATIONS = {
    Alchemist: [
        {
            id: 'EnergizingElixir',
            label: 'Energizing Elixir',
            effects: { speedPercent: 15 },
            condition: 'After drinking Energizing Elixir.',
        },
    ],
    Cleric: [
        {
            id: 'Celestial',
            label: 'Celestial Blessing',
            flagPrefix: 'celestial_blessing',
            effects: { speedPercent: 20 },
            charmStats: {
                speedPercent: 'celestial_blessing_speed_amplifier_percent',
                classAllDamagePercent: 'celestial_blessing_damage_modifier_percent',
            },
            summary: 'Lv 1: +20% Damage, +20% Speed. Lv 2: +30% Damage, +20% Speed.',
            condition: 'While the blessing is active (15s).',
        },
        {
            id: 'Sanctified',
            label: 'Sanctified Armor',
            effects: { resistancePercent: 20, knockbackPercent: 50 },
            effectsLv2: { resistancePercent: 30, knockbackPercent: 50 },
            charmStats: { resistancePercent: 'sanctified_armor_resistance_percent' },
            condition: 'While Sanctified (7s), after losing 40% HP in 1s or dropping below 40% HP.',
        },
        {
            id: 'Illuminate',
            label: 'Illuminate',
            effects: { speedPercent: 20 },
            effectsLv2: { speedPercent: 20, allDamagePercent: 10 },
            charmStats: {
                speedPercent: 'illuminate_speed_amplifier_percent',
                allDamagePercent: 'illuminate_strength_amplifier_percent',
            },
            condition: 'While standing in Illuminate’s trail (4s). Lv 2 also grants damage.',
        },
    ],
    Mage: [],
    Rogue: [
        {
            id: 'AdvancingShadows',
            label: 'Advancing Shadows',
            effects: { meleeDamagePercent: 30 },
            effectsLv2: { meleeDamagePercent: 40 },
            charmStats: { meleeDamagePercent: 'advancing_shadows_damage_multiplier_percent' },
            condition: 'For 5s after teleporting (requires two swords).',
        },
        {
            id: 'Dodging',
            label: 'Dodging',
            effectsLv2: { speedPercent: 20 },
            charmStats: { speedPercent: 'dodging_speed_amplifier_percent' },
            condition: 'For 15s after Dodging activates (Lv 2 only).',
        },
        {
            id: 'Skirmisher',
            label: 'Skirmisher',
            effects: { flatMeleeDamage: 1, meleeDamagePercent: 10 },
            effectsLv2: { flatMeleeDamage: 2, meleeDamagePercent: 15 },
            charmStats: { meleeDamagePercent: 'skirmisher_damage_multiplier_percent' },
            condition: 'Against a mob with another mob within 2.5 blocks.',
        },
        {
            id: 'ByMyBlade',
            label: 'By My Blade',
            effects: { critFlatDamage: 8 },
            enhancedEffects: { critFlatDamage: 12, attackSpeedPercent: 10 },
            charmStats: { attackSpeedPercent: 'by_my_blade_attack_speed_amplifier_percent' },
            charmScale: { critFlatDamage: 'by_my_blade_damage_percent' },
            condition: 'On a critical hit (modeled at half uptime).',
        },
    ],
    Scout: [
        {
            id: 'Sharpshooter',
            label: 'Sharpshooter',
            stacks: {
                name: 'skillStack-Sharpshooter',
                label: 'Sharpshooter stacks',
                hint: 'Sharpshooter stacks (max 20 at Lv 1, 30 at Lv 2)',
                max: 20,
                maxLv2: 30,
                perStack: { projectileDamagePercent: 1 },
                perStackLv2: { projectileDamagePercent: 1 },
            },
            condition: 'Per Sharpshooter stack (stacks decay after 6s).',
        },
    ],
    Shaman: [
        {
            id: 'Spiritualism',
            label: 'Spiritualism',
            effects: { healingPercent: 10 },
            effectsLv2: { healingPercent: 20 },
            charmStats: { healingPercent: 'spiritualism_base_healing_percent' },
            condition: 'Always (self healing).',
        },
    ],
    Warlock: [
        {
            id: 'CursedWound',
            label: 'Cursed Wound',
            stacks: {
                name: 'skillStack-CursedWound',
                label: 'Abilities on cooldown',
                hint: 'Abilities on cooldown (max 3)',
                max: 3,
                perStack: { meleeDamagePercent: 5 },
                perStackLv2: { meleeDamagePercent: 10 },
            },
            charmStackStats: { meleeDamagePercent: 'cursed_wound_damage_modifier_percent' },
            condition: 'Per ability on cooldown (max 3).',
        },
        {
            id: 'Phlegmatic',
            label: 'Phlegmatic Resolve',
            stacks: {
                name: 'skillStack-Phlegmatic',
                label: 'Abilities on cooldown',
                hint: 'Abilities on cooldown (max 3)',
                max: 3,
                perStack: { resistancePercent: 3, knockbackPercent: 10 },
                perStackLv2: { resistancePercent: 5, knockbackPercent: 10 },
            },
            charmStackStats: {
                resistancePercent: 'phlegmatic_resolve_resistance_percent',
                knockbackPercent: 'phlegmatic_resolve_knockback_resistance_percent',
            },
            condition: 'Per ability on cooldown (max 3).',
        },
        {
            id: 'Melancholic',
            label: 'Melancholic Lament',
            stacks: {
                name: 'skillStack-Melancholic',
                label: 'Mobs targeting you',
                hint: 'Mobs targeting you (max 6)',
                max: 6,
                perStack: { meleeDamagePercent: 2.5 },
            },
            charmStackStats: { meleeDamagePercent: 'melancholic_lament_enhancement_damage_modifier_percent' },
            condition: 'Enhancement: for 8s after casting, per mob targeting you (max 6).',
        },
    ],
    Warrior: [
        {
            id: 'Toughness',
            label: 'Toughness',
            flagPrefix: 'toughness',
            charmStats: {
                toughnessHealthPercent: 'toughness_health_percent',
                toughnessHealingPercent: 'toughness_healing_increase_percent',
            },
            summary:
                'Lv 1: +10% Max Health, +20% Ailment Resistance. Lv 2: +20% Max Health, +40% Ailment Resistance. Enhancement: +5% Max Health and +20% Healing below 50% HP.',
            condition: 'Always.',
        },
        {
            id: 'Frenzy',
            label: 'Frenzy',
            flagPrefix: 'frenzy',
            charmStats: {
                attackSpeedPercent: 'frenzy_attack_speed_percent',
                frenzySpeedPercent: 'frenzy_speed_percent',
                frenzyBonusDamagePercent: 'frenzy_bonus_damage_percent',
            },
            summary: 'Lv 1: +30% Attack Speed. Lv 2: +40% Attack Speed, +20% Speed. Enhancement: +20% Melee Damage.',
            condition: 'For 5s after killing a mob.',
        },
        {
            id: 'WeaponMastery',
            label: 'Weapon Mastery',
            flagPrefix: 'weapon_mastery',
            charmStats: { weaponMasterySpeedPercent: 'weapon_mastery_speed_percent' },
            summary:
                'Axe: +2 flat, +5% (Lv 1); +4 flat, +10% (Lv 2). Sword: +1 flat, +10% (Lv 2), +10% Resistance. Enhancement: +10% damage; +15% Speed with an axe.',
            condition: 'While holding an axe (damage) or a sword (resistance and Lv 2 damage).',
        },
        {
            id: 'CounterStrike',
            label: 'Counter Strike',
            effects: { meleeDamagePercent: 10 },
            effectsLv2: { meleeDamagePercent: 20 },
            charmStats: { meleeDamagePercent: 'counter_strike_damage_percent' },
            condition: 'Against a mob with a Counter Strike primed (4s).',
        },
        {
            id: 'DefensiveLine',
            label: 'Defensive Line',
            effects: { resistancePercent: 20 },
            effectsLv2: { resistancePercent: 30 },
            charmStats: { resistancePercent: 'defensive_line_resistance_percent' },
            condition: 'While affected by Defensive Line (10s).',
        },
    ],
};

export const SPEC_CALCULATIONS = {
    'Alchemist:Harbinger': [
        {
            id: 'Taboo',
            label: 'Taboo',
            specSkill: true,
            flagPrefix: 'taboo',
            charmStats: { magicDamagePercent: 'taboo_damage_modifier_percent' },
            summary: 'Lv 1: +30% Magic Damage. Lv 2: +40% Magic Damage.',
            condition: 'While transformed by Taboo.',
        },
    ],
    'Alchemist:Apothecary': [
        {
            id: 'Transmutation',
            label: 'Transmutation Ring',
            specSkill: true,
            effects: { allDamagePercent: 15 },
            charmStats: { allDamagePercent: 'transmutation_ring_damage_amplifier_percent' },
            condition: 'While inside the Transmutation Ring (8s).',
        },
    ],
    'Cleric:Paladin': [
        {
            id: 'Unwavering',
            label: 'Unwavering',
            passive: true,
            effects: { knockbackPercent: 40 },
            condition: 'Five heretics within 8 blocks (+8% each).',
        },
    ],
    'Rogue:Swordsage': [
        {
            id: 'DeadlyRonde',
            label: 'Deadly Ronde',
            specSkill: true,
            effects: { speedPercent: 20 },
            condition: 'After Deadly Ronde.',
        },
    ],
    'Scout:Ranger': [
        {
            id: 'Elusive',
            label: 'Elusive',
            passive: true,
            effects: { resistancePercent: 10 },
            condition: 'Four stacks at +2.5% Resistance each.',
        },
    ],
    'Scout:Hunter': [
        {
            id: 'Deadeye',
            label: 'Deadeye',
            passive: true,
            stacks: {
                name: 'skillStack-Deadeye',
                label: 'Blocks away',
                hint: 'Blocks away from the target (max 25)',
                max: 25,
                perStack: { projectileDamagePercent: 2 },
            },
            condition: 'Per block away from the target (max 25).',
        },
    ],
    'Warlock:Reaper': [
        {
            id: 'DarkPact',
            label: 'Dark Pact',
            specSkill: true,
            effects: { meleeDamagePercent: 50, healingPercent: -100 },
            effectsLv2: { meleeDamagePercent: 75, healingPercent: -100 },
            charmStats: { meleeDamagePercent: 'dark_pact_melee_damage_percent' },
            condition: 'While the pact is active (7s). Healing is set to 0.',
        },
    ],
    'Warrior:Guardian': [
        {
            id: 'Challenge',
            label: 'Challenge',
            specSkill: true,
            stacks: {
                name: 'skillStack-Challenge',
                label: 'Taunted mobs',
                hint: 'Taunted mobs (max 4)',
                max: 4,
                perStack: { meleeDamagePercent: 5 },
                perStackLv2: { meleeDamagePercent: 7.5 },
            },
            charmStackStats: { meleeDamagePercent: 'challenge_melee_damage_amplifier_per_mob_percent' },
            condition: 'Per taunted mob (max 4), for 10s.',
        },
    ],
};
