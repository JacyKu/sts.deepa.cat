// Stat effects of class skills and specialization passives/skills that the
// builder's "Skill & Spec Calculations" row can include.
//
// Entries are shown as toggles (all off by default). `flagPrefix` entries are
// the skills the stat engine already models: their toggle turns the matching
// `enabledClassAbilityBuffs` keys on. Everything else contributes the
// documented values (stack-dependent skills use their normal stacks, and
// timed buffs their usual uptime).
export const CLASS_SKILL_CALCULATIONS = {
    Alchemist: [
        {
            id: 'EnergizingElixir',
            label: 'Energizing Elixir',
            effects: { speedPercent: 15 },
        },
    ],
    Cleric: [
        { id: 'Celestial', label: 'Celestial Blessing', flagPrefix: 'celestial_blessing' },
        {
            id: 'Sanctified',
            label: 'Sanctified Armor',
            effects: { resistancePercent: 20, knockbackPercent: 50 },
        },
        {
            id: 'Illuminate',
            label: 'Illuminate',
            effects: { speedPercent: 20, allDamagePercent: 10 },
        },
    ],
    Mage: [],
    Rogue: [
        {
            id: 'AdvancingShadows',
            label: 'Advancing Shadows',
            effects: { meleeDamagePercent: 30 },
        },
        {
            id: 'Dodging',
            label: 'Dodging',
            effects: { speedPercent: 20 },
        },
        {
            id: 'Skirmisher',
            label: 'Skirmisher',
            effects: { meleeDamagePercent: 10 },
        },
        {
            id: 'ByMyBlade',
            label: 'By My Blade',
            // Half uptime, like the 4s buff / 8s cooldown.
            effects: { critFlatDamage: 8 },
            enhancedEffects: { critFlatDamage: 12, attackSpeedPercent: 10 },
        },
    ],
    Scout: [
        {
            id: 'Sharpshooter',
            label: 'Sharpshooter',
            // 20 stacks at +1% projectile damage each.
            effects: { projectileDamagePercent: 20 },
        },
    ],
    Shaman: [{ id: 'Spiritualism', label: 'Spiritualism', effects: { healingPercent: 10 } }],
    Warlock: [
        {
            id: 'CursedWound',
            label: 'Cursed Wound',
            // Three abilities on cooldown at +5% melee damage each.
            effects: { meleeDamagePercent: 15 },
        },
        {
            id: 'Phlegmatic',
            label: 'Phlegmatic Resolve',
            // Three abilities on cooldown at +3% resistance and +10% KB each.
            effects: { resistancePercent: 9, knockbackPercent: 30 },
        },
    ],
    Warrior: [
        { id: 'Toughness', label: 'Toughness', flagPrefix: 'toughness' },
        { id: 'Frenzy', label: 'Frenzy', flagPrefix: 'frenzy' },
        { id: 'WeaponMastery', label: 'Weapon Mastery', flagPrefix: 'weapon_mastery' },
        {
            id: 'CounterStrike',
            label: 'Counter Strike',
            effects: { meleeDamagePercent: 10 },
        },
        {
            id: 'DefensiveLine',
            label: 'Defensive Line',
            effects: { resistancePercent: 20 },
        },
    ],
};

export const SPEC_CALCULATIONS = {
    'Alchemist:Harbinger': [{ id: 'Taboo', label: 'Taboo', flagPrefix: 'taboo', specSkill: true }],
    'Alchemist:Apothecary': [
        {
            id: 'Transmutation',
            label: 'Transmutation Ring',
            specSkill: true,
            effects: { allDamagePercent: 15 },
        },
    ],
    'Cleric:Paladin': [
        {
            id: 'Unwavering',
            label: 'Unwavering',
            passive: true,
            // Five heretics within 8 blocks at +8% KB resistance each.
            effects: { knockbackPercent: 40 },
        },
    ],
    'Rogue:Swordsage': [
        {
            id: 'DeadlyRonde',
            label: 'Deadly Ronde',
            specSkill: true,
            effects: { speedPercent: 20 },
        },
    ],
    'Scout:Ranger': [
        {
            id: 'Elusive',
            label: 'Elusive',
            passive: true,
            // Four stacks at +2.5% resistance each.
            effects: { resistancePercent: 10 },
        },
    ],
    'Scout:Hunter': [
        {
            id: 'Deadeye',
            label: 'Deadeye',
            passive: true,
            // 25 blocks at +2% projectile damage each.
            effects: { projectileDamagePercent: 50 },
        },
    ],
    'Warlock:Reaper': [
        {
            id: 'DarkPact',
            label: 'Dark Pact',
            specSkill: true,
            // Half uptime, like the 7s buff / 14s cooldown.
            effects: { meleeDamagePercent: 25, healingPercent: -50 },
        },
    ],
    'Warrior:Guardian': [
        {
            id: 'Challenge',
            label: 'Challenge',
            specSkill: true,
            // Four taunted mobs at +5% melee damage each.
            effects: { meleeDamagePercent: 20 },
        },
    ],
};
