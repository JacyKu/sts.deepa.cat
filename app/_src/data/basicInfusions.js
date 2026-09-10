// Basic (normal) infusions from the Monumenta wiki.
// Source: https://monumenta.wiki.gg/wiki/Basic_Infusions
//
// One basic infusion per item, up to level 4 each (24 levels max across the
// six equipment slots). The damage infusions scale with the item's region:
// X is 1 / 1.25 / 1.5 in Valley / Isles / Ring.
export const BASIC_INFUSIONS = [
    { name: 'Tenacity', effect: 'Take (0.5% × level) less damage.' },
    { name: 'Vitality', effect: 'Gain (1% × level) max health.' },
    { name: 'Vigor', effect: 'Deal (1% / 1.25% / 1.5% × level) more melee damage in Valley / Isles / Ring.' },
    { name: 'Focus', effect: 'Deal (1% / 1.25% / 1.5% × level) more projectile damage in Valley / Isles / Ring.' },
    { name: 'Perspicacity', effect: 'Deal (1% / 1.25% / 1.5% × level) more magic damage in Valley / Isles / Ring.' },
    { name: 'Acumen', effect: 'Gain (2% × level) more experience.' },
];

export const BASIC_INFUSION_MAX_LEVEL = 4;
export const BASIC_INFUSION_LEVEL_LABELS = ['I', 'II', 'III', 'IV'];
