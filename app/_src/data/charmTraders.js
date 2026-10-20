// Charm sellers in the Architect's Ring, grouped by the class skills whose
// charms they sell. The wiki lists sellers this way; the item data names the
// same skills in its stat keys, so a charm can be matched to its seller
// without a per-item table (see utils/items/charmWiki.js).
//
// Source: https://monumenta.wiki.gg/wiki/List_of_Charm_Traders (read 2026-10-18)
// `section` is the wiki anchor for the seller's class list.
export const CHARM_TRADERS = [
    {
        npc: 'Elantia, Aradia Potionmaster',
        coords: '-621 58 -267',
        section: 'Alchemist_Charm_NPCs',
        skills: ['Brutal Alchemy', 'Energizing Elixir', 'Unstable Amalgam', 'Alchemical Artillery'],
    },
    {
        // The wiki does not give this one's name.
        npc: 'Shade Alchemist',
        coords: '-395 174 141',
        section: 'Alchemist_Charm_NPCs',
        skills: ['Bezoar', 'Iron Tincture', 'Empowering Odor', 'Gruesome Alchemy'],
    },
    {
        npc: 'Jasek, Coven Wanderer',
        coords: '164 162 982',
        section: 'Alchemist_Charm_NPCs',
        skills: ['Taboo', 'Esoteric Enhancements', 'Scorched Earth', 'Transmutation Ring', 'Warding Remedy', 'Panacea'],
    },
    {
        npc: 'Ryker of the Silver Order',
        coords: '-559 152 -186',
        section: 'Cleric_Charm_NPCs',
        skills: ['Sanctified Armor', 'Hand of Light', 'Illuminate'],
    },
    {
        npc: 'Landrey, Silver Cleric',
        coords: '-422 179 226',
        section: 'Cleric_Charm_NPCs',
        skills: ['Celestial Blessing', 'Heavenly Boon', 'Cleansing Rain', 'Touch of Radiance'],
    },
    {
        npc: 'Eckoun, Preacher of Heavens',
        coords: '27 214 1082',
        section: 'Cleric_Charm_NPCs',
        skills: [
            'Luminous Infusion',
            'Choir Bells',
            'Holy Javelin',
            'Hallowed Beam',
            'Ethereal Ascension',
            'Keeper Virtue',
        ],
    },
    {
        npc: 'Arlow, Fen Arcanist',
        coords: '-480 118 -499',
        section: 'Mage_Charm_NPCs',
        skills: ['Mana Lance', 'Thunder Step', 'Prismatic Shield', 'Frost Nova'],
    },
    {
        npc: 'Iliati, Silver Collector',
        coords: '-343 56 -57',
        section: 'Mage_Charm_NPCs',
        skills: ['Magma Shield', 'Elemental Arrows', 'Arcane Strike', 'Spellshock'],
    },
    {
        npc: 'Simeone, Displaced Warpmage',
        coords: '40 126 1441',
        section: 'Mage_Charm_NPCs',
        skills: ['Elemental Spirits', 'Blizzard', 'Starfall', 'Cosmic Moonblade', 'Astral Omen'],
    },
    {
        // Also appears east of the New Antium teleport hub (-433 179 -68) once
        // Sanguine Halls has been entered.
        npc: 'Markus, Silver Swordsman',
        coords: '-167 100 -355',
        section: 'Rogue_Charm_NPCs',
        skills: ['Advancing Shadows', 'By My Blade', 'Dodging', 'Skirmisher'],
    },
    {
        npc: 'Raffati, Eastern Pilgrim',
        coords: '-481 71 54',
        section: 'Rogue_Charm_NPCs',
        skills: ['Dagger Throw', 'Smokescreen', 'Escape Death', 'Vicious Combos'],
    },
    {
        npc: 'Shimmer, Silent Bladelord',
        coords: '141 198 1208',
        section: 'Rogue_Charm_NPCs',
        skills: ['Blade Dance', 'Wind Walk', 'Deadly Ronde', 'Bodkin Blitz', 'Cloak and Dagger', 'Coup de Grace'],
    },
    {
        npc: 'Louitte, Dichen Watchman',
        coords: '-241 93 -481',
        section: 'Scout_Charm_NPCs',
        skills: ['Tactical Maneuver', 'Lockdown', 'Volley', 'Parting Shot', 'Steel Trap'],
    },
    {
        npc: 'Tarly, Ashkii Scout',
        coords: '-469 193 93',
        section: 'Scout_Charm_NPCs',
        skills: ['Wind Bomb', 'Hunting Companion', 'Shrapnel Bomb'],
    },
    {
        npc: 'Mariask, Lunacrest Scout',
        coords: '-24 86 1079',
        section: 'Scout_Charm_NPCs',
        skills: ['Tactical Maneuver', 'Gale Shot', 'Quiver Storm', 'Lockdown', 'Predator Strike', 'Rending Razor'],
    },
    {
        npc: 'Mylasi',
        coords: '-509 107 -274',
        section: 'Shaman_Charm_NPCs',
        skills: ['Cleansing Totem', 'Lightning Totem', 'Totemic Projection', 'Earthen Tremor'],
    },
    {
        npc: 'Quintus, Elevator Shade',
        coords: '-306 197 182',
        section: 'Shaman_Charm_NPCs',
        skills: ['Flame Totem', 'Chain Lightning', 'Interconnected Havoc', 'Crystalline Combos'],
    },
    {
        npc: "X'etra, Totemic Rambler",
        coords: '101 169 1083',
        section: 'Shaman_Charm_NPCs',
        skills: [
            'Sanctuary',
            'Whirlwind Totem',
            'Chain Healing Wave',
            'Desecrating Shot',
            'Decayed Totem',
            'Devastation',
        ],
    },
    {
        npc: 'Taindail, Starbound',
        coords: '-412 177 511',
        section: 'Warlock_Charm_NPCs',
        skills: ['Amplifying Hex', 'Choleric Flames', 'Phlegmatic Resolve', 'Soul Rend'],
    },
    {
        npc: 'Partienne, Blood Ritualist',
        coords: '-612 82 -346',
        section: 'Warlock_Charm_NPCs',
        skills: ['Melancholic Lament', 'Grasping Claws', 'Sanguine Harvest', 'Cursed Wound'],
    },
    {
        npc: 'Jq, Gorecaster',
        coords: '76 68 836',
        section: 'Warlock_Charm_NPCs',
        skills: ['Judgement Chain', 'Dark Pact', 'Voodoo Bonds', 'Withering Gaze', 'Haunting Shades', 'Restless Souls'],
    },
    {
        npc: 'Elgart, Shade Hunter',
        coords: '-425 179 224',
        section: 'Warrior_Charm_NPCs',
        skills: ['Frenzy', 'Counter Strike', 'Brute Force'],
    },
    {
        npc: 'Morel, Mycelian Conkat',
        coords: '-257 43 -366',
        section: 'Warrior_Charm_NPCs',
        skills: ['Shield Bash', 'Defensive Line', 'Riposte'],
    },
    {
        npc: 'Mersewys, Rootway Excavator',
        coords: '273 102 715',
        section: 'Warrior_Charm_NPCs',
        skills: ['Shield Wall', 'Bodyguard', 'Challenge', 'Rampage', 'Glorious Battle', 'Meteor Slam'],
    },
];
