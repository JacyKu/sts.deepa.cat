import Select, { components } from 'react-select';
import { createPortal } from 'react-dom';
import SelectInput from '../items/selectInput';
import FloatingLabel from '../items/floatingLabel';
import CheckboxWithLabel from '../items/checkboxWithLabel';
import ItemTile from '../items/itemTile';
import MasterworkableItemTile from '../items/masterworkableItemTile';
import CharmTile from '../items/charmTile';
import BuildImportBar from './buildImportBar';
import SavedSetsPanel from './savedSetsPanel';
import BuilderHeader from '../items/builderHeader';
import styles from '../../styles/Items.module.css';
import React from 'react';
import { getStsBase } from '../../utils/base';

import Stats from '../../utils/builder/stats';
import TranslatableText from '../translatableText';
import { useTranslation } from '../useTranslation';
import ListSelector from './listSelector';
import CharmSelector, { resolveCharmKey, computeCharmTotals, computeCharmStatColors } from './charmSelector';
import CharmFormatter from '../../utils/items/charmFormatter';
import CharmShortener from '../../utils/builder/charmShortener';
import { useItemFavourites } from '../items/itemFavouritesContext';
import { useMaxMasterwork } from '../items/maxMasterworkContext';
import { filterBadWords } from '../../utils/badWords';
import {
    decodeBuildParam,
    encodeBuildParam,
    normalizeBuildParam,
    getBuildTokenVersion,
} from '../../utils/builder/buildUrlCodec';
import { skillsPayloadFromToken } from '../../utils/builder/buildSkills';
import { DELVE_INFUSIONS } from '../../data/delveInfusions';
import { BASIC_INFUSIONS, BASIC_INFUSION_MAX_LEVEL, BASIC_INFUSION_LEVEL_LABELS } from '../../data/basicInfusions';
import { isBuildsCacheEnabled, DRAFT_DATA_KEY, ORDER_PREFIX as ORDER_PREFIX_KEY } from '../../utils/cachePrefs';
import { getInfusionInputMode } from '../../utils/infusionPrefs';
import { loadSkills, loadCz } from '../../utils/siteDataClient';
import { useBuilderLayout } from '../builderLayoutContext';

// Whether the viewport is desktop-width (>= 992px). The experimental
// "New Layout" only applies on desktop; mobile always keeps the standard
// layout regardless of the setting.
function useIsDesktop() {
    const [isDesktop, setIsDesktop] = React.useState(false);
    React.useEffect(() => {
        const mq = window.matchMedia('(min-width: 992px)');
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return isDesktop;
}

const infusionSelectTheme = (theme) => ({
    ...theme,
    borderRadius: 0,
    colors: {
        ...theme.colors,
        primary: 'var(--text-1)',
        primary25: 'var(--surface-2)',
        neutral0: 'var(--glass-menu)',
        neutral5: 'var(--glass-2)',
        neutral10: 'var(--glass-2)',
        neutral20: 'var(--control-border)',
        neutral30: 'var(--control-border-hover)',
        neutral60: 'var(--text-2)',
        neutral80: 'var(--text-1)',
    },
});

const infusionSelectStyles = {
    container: (base) => ({ ...base, width: '100%', minWidth: 120 }),
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

const levelSelectStyles = {
    container: (base) => ({ ...base, width: 56, minWidth: 56, maxWidth: 56 }),
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({
        ...base,
        height: 42,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 6,
        paddingRight: 0,
    }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
    dropdownIndicator: (base) => ({ ...base, padding: 4 }),
    indicatorSeparator: () => ({ display: 'none' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

const emptyBuild = {
    mainhand: 'None',
    offhand: 'None',
    helmet: 'None',
    chestplate: 'None',
    leggings: 'None',
    boots: 'None',
};

// Session autosave: the current build draft is kept in localStorage so an
// accidental reload / navigation away doesn't lose unsaved work. Restored on
// the plain /builder page, or on /b/<id> when the draft belongs to that build.
// Skipped entirely when the "Cache builds" setting is off.
const DRAFT_KEY = DRAFT_DATA_KEY;

// Build list (shopping list): items collected on the items page are read from
// localStorage on mount and equipped into empty slots. Leftovers (misc items,
// consumables, extra same-slot items) stay in the list for the next import.
const BUILD_LIST_KEY = 'sts.buildList.v1';

const MAINHAND_TYPES = new Set([
    'mainhand',
    'mainhand sword',
    'mainhand shield',
    'axe',
    'pickaxe',
    'wand',
    'scythe',
    'bow',
    'crossbow',
    'snowball',
    'trident',
    'alchemist bag',
]);
const OFFHAND_TYPES = new Set(['offhand', 'offhand shield', 'offhand sword']);
const EQUIP_SLOTS = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];

// True when any gear slot actually holds an item (vs. the 'None' default).
// The share/copy buttons read this so an empty, never-built form can't be
// saved into a junk share link. The slot selects write hidden inputs with
// their `name`, so a plain FormData pass tells us what is equipped.
function formHasEquippedItem(formEl) {
    if (!formEl) return false;
    try {
        const form = new FormData(formEl);
        return EQUIP_SLOTS.some((slot) => {
            const value = form.get(slot);
            return value != null && String(value) !== 'None';
        });
    } catch (e) {
        return false;
    }
}

function resolveItemKey(itemData, displayName) {
    if (itemData[displayName]) return displayName;
    return Object.keys(itemData).find((key) => itemData[key].name === displayName) || null;
}

function readBuildList() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(BUILD_LIST_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

// The build list only imports when the "Item import" menu toggle is on.
function isBuildListEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem('buildListEnabled') === 'true';
    } catch (e) {
        return false;
    }
}

// Reorderable skill/ability lists: the custom order (a personal layout
// preference) is stored in localStorage per class / specialization / tree,
// unless the "Cache builds" setting is off.
const ORDER_PREFIX = ORDER_PREFIX_KEY;

function readOrder(container) {
    if (typeof window === 'undefined' || !isBuildsCacheEnabled()) return null;
    try {
        const raw = window.localStorage.getItem(ORDER_PREFIX + container);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeOrder(container, orderedKeys) {
    if (typeof window === 'undefined' || !isBuildsCacheEnabled()) return;
    try {
        window.localStorage.setItem(ORDER_PREFIX + container, JSON.stringify(orderedKeys));
    } catch (e) {}
}

// Sort items by the stored order; items without an entry keep their relative
// order after the ones that do.
function applyStoredOrder(items, keyOf, container) {
    const order = readOrder(container);
    if (!order || order.length === 0) return items;
    const idx = new Map(order.map((k, i) => [k, i]));
    return [...items].sort((a, b) => {
        const ia = idx.has(keyOf(a)) ? idx.get(keyOf(a)) : Number.MAX_SAFE_INTEGER;
        const ib = idx.has(keyOf(b)) ? idx.get(keyOf(b)) : Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        return items.indexOf(a) - items.indexOf(b);
    });
}

// Move `fromKey` to `toKey`'s slot in the given (already-sorted) list.
function moveInOrder(list, keyOf, fromKey, toKey) {
    const next = [...list];
    const from = next.findIndex((it) => keyOf(it) === fromKey);
    if (from === -1) return next;
    const [moved] = next.splice(from, 1);
    const to = next.findIndex((it) => keyOf(it) === toKey);
    if (to === -1) next.push(moved);
    else next.splice(to, 0, moved);
    return next;
}

const enabledBoxes = {
    // Situational Defense
    shielding: false,
    poise: false,
    inure: false,
    steadfast: false,
    guard: false,
    second_wind: false,
    ethereal: false,
    reflexes: false,
    evasion: false,
    tempo: false,
    cloaked: false,
    earth_aspect: false,
    curse_of_the_veil: false,

    // Situational Damage
    smite: false,
    duelist: false,
    slayer: false,
    point_blank: false,
    sniper: false,
    first_strike: false,
    momentum: false,
    regicide: false,
    trivium: false,
    stamina: false,
    technique: false,
    abyssal: false,
    fractal: false,
    skyseeker: false,
    backstab: false,
    retaliation_normal: false,
    retaliation_elite: false,
    retaliation_boss: false,

    // Class-ability situationals (Warrior Frenzy's on-kill buff).
    frenzy: false,
    frenzy_enhancement: false,

    // Delve infusion situationals: the infusion's stat effect only counts
    // while its checkbox is ticked (matches the infusion's in-game condition).
    vengeful: false,
    execution: false,
    fervor: false,
    choler: false,
    celestial: false,
    grace: false,
    nutriment: false,
    soothing: false,
    unyielding: false,
    epoch: false,
    expedite: false,
    ardor: false,
    carapace: false,
    fueled: false,
    orbital: false,
    pennate: false,
    // Understanding amplifies the basic (non-Delve) infusions every item
    // carries; the chip decides whether that bonus is counted.
    understanding: false,
};

const situationalDefenses = [
    'shielding',
    'poise',
    'inure',
    'steadfast',
    'guard',
    'second_wind',
    'ethereal',
    'reflexes',
    'evasion',
    'tempo',
    'cloaked',
    'earth_aspect',
    'curse_of_the_veil',
];

const situationalFlatDamage = ['smite', 'duelist', 'slayer', 'point_blank', 'sniper'];

const situationalPercentDamage = [
    'first_strike',
    'momentum',
    'regicide',
    'trivium',
    'stamina',
    'technique',
    'abyssal',
    'fractal',
    'skyseeker',
    'backstab',
    'retaliation_normal',
    'retaliation_elite',
    'retaliation_boss',
];

const extraStats = {
    damageMultipliers: [],
    resistanceMultipliers: [],
    healthMultipliers: [],
    speedMultipliers: [],
    attackSpeedMultipliers: [],
};

const itemTypes = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];

// Extra stat inputs that are part of the build (shared in the link under their full names).
const STAT_KEYS = ['health', 'tenacity', 'vitality', 'vigor', 'focus', 'perspicacity', 'region'];

const DEFAULT_STAT_INPUTS = { health: '100', tenacity: '0', vitality: '0', vigor: '0', focus: '0', perspicacity: '0' };

// The stats normal (basic) infusions feed, in display order, and the shared
// budget for both entry paths (6 items x level IV).
const BASIC_INFUSION_STAT_KEYS = ['tenacity', 'vitality', 'vigor', 'focus', 'perspicacity'];
// Number boxes above the multipliers: every normal infusion type, Acumen
// included. Acumen feeds no stat, but it shares the 24-level item budget, so
// it is entered and distributed like the others.
const BASIC_INFUSION_BOX_KEYS = BASIC_INFUSIONS.map((infusion) => infusion.name.toLowerCase());
const BASIC_INFUSION_LEVEL_CAP = 24;

const classes = ['Alchemist', 'Cleric', 'Mage', 'Rogue', 'Scout', 'Shaman', 'Warlock', 'Warrior'];

// API skill scoreboardIds that feed the stat calculation (the rest of the
// skills are selected and exported, but don't change the stat cards).
const skillBuffKeys = {
    Celestial: 'celestial_blessing',
    WeaponMastery: 'weapon_mastery',
    Toughness: 'toughness',
    Frenzy: 'frenzy',
};

// Spec skill scoreboardIds that feed the stat calculation.
const specSkillBuffKeys = {
    Taboo: 'taboo',
};

const MAX_ENHANCEMENT_POINTS = 3;
const MAX_SPEC_POINTS = 4;
const MAX_SKILL_POINTS = 10;

const enabledClassAbilityBuffs = {
    versatile: false,
    weapon_mastery: false,
    weapon_mastery_lv1: false,
    weapon_mastery_lv2: false,
    weapon_mastery_enhancement: false,
    formidable: false,
    dethroner_elite: false,
    dethroner_boss: false,
    culling: false,
    totemic_empowerment: false,
    taboo_lv1: false,
    taboo_lv2: false,
    taboo_burst: false,
    channeling: false,
    celestial_blessing_lv1: false,
    celestial_blessing_lv2: false,
    toughness_lv1: false,
    toughness_lv2: false,
    toughness_enhancement: false,
    frenzy: false,
    frenzy_lv1: false,
    frenzy_lv2: false,
    frenzy_lv3: false,
};

function groupMasterwork(items, itemData) {
    // Group up masterwork tiers by their name using an object, removing them from items.
    let masterworkItems = {};
    // Go through the array in reverse order to have the splice work properly
    // (items will go down in position if not removed from the end)
    for (let i = items.length - 1; i >= 0; i--) {
        let name = items[i];
        if (itemData[name].masterwork != undefined) {
            let itemName = itemData[name].name;
            if (!masterworkItems[itemName]) {
                masterworkItems[itemName] = [];
            }
            masterworkItems[itemName].push(itemData[name]);
            items.splice(i, 1);
        }
    }

    Object.keys(masterworkItems).forEach((item) => {
        items.push({ value: `${item}-${masterworkItems[item][0].masterwork}`, label: item });
    });

    return items;
}

function getRelevantItems(types, itemData, favourites = new Set()) {
    let items = Object.keys(itemData);
    items = groupMasterwork(
        items.filter((name) => types.includes(itemData[name].type.toLowerCase().replace(/<.*>/, '').trim())),
        itemData
    );
    // Custom items may be keyed by id (when their name collides with an
    // existing item); always show the item's name in the selector.
    items = items.map((item) =>
        typeof item === 'object' || !itemData[item].isCustomItem ? item : { value: item, label: itemData[item].name }
    );
    // Pin the user's favourited items to the top of the selector (stable
    // sort keeps the original order within each group). Masterwork groups
    // and custom items are {value, label} objects whose label is the item name.
    return [...items].sort((a, b) => {
        const aName = typeof a == 'object' ? a.label : itemData[a].name;
        const bName = typeof b == 'object' ? b.label : itemData[b].name;
        return Number(favourites.has(bName)) - Number(favourites.has(aName));
    });
}

// The Stats engine is deterministic: identical inputs produce the identical
// result. Cache the last few instances keyed on a cheap signature of exactly
// what the engine reads (item names, region, infusions, stat inputs, and the
// mutable enabledBoxes/extraStats/enabledClassAbilityBuffs objects), so an
// interaction that doesn't change those inputs reuses the previous result
// instead of recomputing. itemData is keyed by reference (it is stable for the
// session) so the 2.6 MB data object is never serialized.
const STATS_CACHE_MAX = 8;
const statsCache = new Map(); // signature -> { itemData, stats }
function recalcBuild(data, itemData) {
    const signature = JSON.stringify({
        region: data.region ?? null,
        items: [
            data.mainhand ?? null,
            data.offhand ?? null,
            data.helmet ?? null,
            data.chestplate ?? null,
            data.leggings ?? null,
            data.boots ?? null,
        ],
        infusions: ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'].map(
            (slot) => data[`delveInfusion-${slot}`] ?? null
        ),
        revelation: data.revelation ?? null,
        // The delve/basic infusion toggles only decide whether the picks
        // count, so they are part of the calculation's inputs too.
        delveEnabled: data.delveEnabled ?? null,
        infusionsEnabled: data.infusionsEnabled ?? null,
        stats: [
            data.tenacity ?? null,
            data.vitality ?? null,
            data.vigor ?? null,
            data.focus ?? null,
            data.perspicacity ?? null,
            data.health ?? null,
        ],
        // Understanding's amplifier is applied per item, so the counts are
        // part of the calculation's inputs.
        counts: data.basicInfusionCounts ?? null,
        eb: enabledBoxes,
        es: extraStats,
        eca: enabledClassAbilityBuffs,
    });
    const hit = statsCache.get(signature);
    if (hit && hit.itemData === itemData) {
        statsCache.delete(signature); // refresh recency (LRU order)
        statsCache.set(signature, hit);
        return hit.stats;
    }
    const tempStats = new Stats(itemData, data, enabledBoxes, extraStats, enabledClassAbilityBuffs);
    statsCache.set(signature, { itemData, stats: tempStats });
    if (statsCache.size > STATS_CACHE_MAX) {
        statsCache.delete(statsCache.keys().next().value);
    }
    return tempStats;
}

// Run the (synchronous, heavy) stats recomputation as a low-priority update so
// the interaction that triggered it (item select, checkbox, ...) paints and
// responds immediately. The two state updates (local stats + parent item
// display) are batched into a single transition render.
// Rapid stat-affecting edits (checkbox clicks, skill buffs, item swaps,
// infusion picks) are coalesced into a single recompute shortly after they
// settle - the displayed stats lag imperceptibly and the calculation itself
// is unchanged.
const statsRecalcPending = { timer: null, itemNames: null, itemData: null, setStats: null, update: null };
function applyStatsUpdate(itemNames, itemData, setStats, update) {
    statsRecalcPending.itemNames = itemNames;
    statsRecalcPending.itemData = itemData;
    statsRecalcPending.setStats = setStats;
    statsRecalcPending.update = update;
    if (statsRecalcPending.timer) clearTimeout(statsRecalcPending.timer);
    statsRecalcPending.timer = setTimeout(() => {
        statsRecalcPending.timer = null;
        const { itemNames: names, itemData: data, setStats: s, update: u } = statsRecalcPending;
        React.startTransition(() => {
            const tempStats = recalcBuild(names, data);
            s(tempStats);
            u(tempStats);
        });
    }, 120);
}

// The immediate variant, used when restoring a build/draft: that work runs in a
// layout effect (before the first paint of the real builder), so the debounce
// above would let the stat cards paint empty and then grow a frame later.
function applyStatsUpdateNow(itemNames, itemData, setStats, update) {
    if (statsRecalcPending.timer) {
        clearTimeout(statsRecalcPending.timer);
        statsRecalcPending.timer = null;
    }
    const tempStats = recalcBuild(itemNames, itemData);
    setStats(tempStats);
    update(tempStats);
}

// Base-name -> masterwork variants, built once per itemData object. Scanning
// the full item list (several thousand entries) for every equipped slot on
// every render was one of the most expensive things the builder did.
let masterworkIndex = null;
let masterworkIndexSource = null;
function createMasterworkData(name, itemData) {
    if (masterworkIndexSource !== itemData) {
        const index = new Map();
        for (const itemName of Object.keys(itemData)) {
            const item = itemData[itemName];
            if (!item || typeof item.name !== 'string') continue;
            const list = index.get(item.name);
            if (list) list.push(item);
            else index.set(item.name, [item]);
        }
        masterworkIndex = index;
        masterworkIndexSource = itemData;
    }
    return masterworkIndex.get(name) || [];
}

function removeMasterworkFromName(name) {
    return name.replace(/-\d$/g, '');
}

function checkExists(type, itemsToDisplay, itemData) {
    let retVal = false;
    if (itemsToDisplay.itemStats) {
        retVal = itemsToDisplay.itemStats[type] !== undefined;
    }
    if (
        itemsToDisplay.itemNames &&
        itemsToDisplay.itemNames[type] &&
        createMasterworkData(removeMasterworkFromName(itemsToDisplay.itemNames[type]), itemData)[0]?.masterwork !=
            undefined
    ) {
        retVal = true;
    }
    return retVal;
}

function formatSituationalName(situ) {
    let ret = situ
        .split('_')
        .map((word) => word[0].toUpperCase() + word.substring(1))
        .join(' ');
    if (ret.match('Retaliation')) return ret.split(' ')[0] + ' (' + ret.split(' ')[1].toLowerCase() + ')';
    return ret;
}

function generateSituationalCheckboxes(itemsToDisplay, checkboxChanged, delveInfusions, classAbilityContext) {
    let tempDef = [];
    let tempFlatDmg = [];
    let tempPercentDmg = [];
    let tempInfusions = [];
    // Class-ability conditional toggles (e.g. Warrior's Frenzy): visible while
    // the ability has points, ticked to count its triggered effect.
    let tempClass = [];

    situationalDefenses.forEach(function (situ) {
        if (!itemsToDisplay.situationals) return;
        if (itemsToDisplay.situationals[situ].level) {
            tempDef.push(
                <div className="col-auto" key={'situationalbox-' + situ}>
                    <CheckboxWithLabel
                        name={formatSituationalName(situ)}
                        enchantName={situ}
                        checked={enabledBoxes[situ]}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        }
    });
    situationalFlatDamage.forEach(function (situ) {
        if (!itemsToDisplay.situationals) return;
        if (itemsToDisplay.situationals[situ].level) {
            tempFlatDmg.push(
                <div className="col-auto" key={'situationalbox-' + situ}>
                    <CheckboxWithLabel
                        name={formatSituationalName(situ)}
                        enchantName={situ}
                        checked={enabledBoxes[situ]}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        }
    });
    situationalPercentDamage.forEach(function (situ) {
        if (!itemsToDisplay.situationals) return;
        if (itemsToDisplay.situationals[situ].level) {
            tempPercentDmg.push(
                <div className="col-auto" key={'situationalbox-' + situ}>
                    <CheckboxWithLabel
                        name={formatSituationalName(situ)}
                        enchantName={situ}
                        checked={enabledBoxes[situ]}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        }
    });
    if (itemsToDisplay.retaliation) {
        ['normal', 'elite', 'boss'].forEach((type) => {
            tempPercentDmg.push(
                <div className="col-auto" key={'situationalbox-retaliation_' + type}>
                    <CheckboxWithLabel
                        name={formatSituationalName('retaliation_' + type)}
                        enchantName={'retaliation'}
                        checked={enabledBoxes['retaliation_' + type]}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        });
    }
    // One situational chip per equipped delve infusion; the stat effect only
    // counts while its checkbox is ticked. Understanding gets a chip too: its
    // bonus (0.2 * level per item) applies to every non-Delve infusion, so the
    // toggle decides whether that amplifier is counted.
    if (delveInfusions) {
        const seen = new Set();
        Object.values(delveInfusions).forEach((infusion) => {
            if (!infusion || infusion === 'None' || seen.has(infusion)) return;
            seen.add(infusion);
            tempInfusions.push(
                <div className="col-auto" key={'situationalbox-infusion-' + infusion}>
                    <CheckboxWithLabel
                        name={infusion}
                        enchantName={infusion}
                        checked={enabledBoxes[infusion.toLowerCase()]}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        });
    }
    // Warrior Frenzy: on-kill attack-speed buff. Only counts while the box is
    // ticked (its magnitude depends on the Frenzy skill level); the skill's
    // Enhancement (next-attack damage) has its own toggle.
    if (classAbilityContext && classAbilityContext.frenzyLevel > 0) {
        const frenzyLabel = classAbilityContext.frenzyLevel >= 2 ? 'Frenzy (Lv 2)' : 'Frenzy';
        tempClass.push(
            <div className="col-auto" key={'classabilitybox-frenzy'}>
                <CheckboxWithLabel
                    name={frenzyLabel}
                    inputName="frenzy"
                    enchantName="frenzy"
                    checked={enabledBoxes.frenzy}
                    onChange={checkboxChanged}
                />
            </div>
        );
        if (classAbilityContext.frenzyEnhanced) {
            tempClass.push(
                <div className="col-auto" key={'classabilitybox-frenzy-enhancement'}>
                    <CheckboxWithLabel
                        name="Frenzy (Enhancement)"
                        inputName="frenzy_enhancement"
                        enchantName="frenzy"
                        checked={enabledBoxes.frenzy_enhancement}
                        onChange={checkboxChanged}
                    />
                </div>
            );
        }
    }

    let temp = [];
    temp.push(...tempDef);
    if (tempDef.length > 0 && tempFlatDmg.length > 0) {
        temp.push(<span key="spacer1" style={{ width: '10px', padding: '0px' }}></span>);
    }
    temp.push(...tempFlatDmg);
    if (temp.length > 0 && tempPercentDmg.length > 0) {
        temp.push(<span key="spacer2" style={{ width: '10px', padding: '0px' }}></span>);
    }
    temp.push(...tempPercentDmg);
    if (temp.length > 0 && tempInfusions.length > 0) {
        temp.push(<span key="spacer3" style={{ width: '10px', padding: '0px' }}></span>);
    }
    temp.push(...tempInfusions);
    if (temp.length > 0 && tempClass.length > 0) {
        temp.push(<span key="spacer-class" style={{ width: '10px', padding: '0px' }}></span>);
    }
    temp.push(...tempClass);
    if (temp.length == 0) {
        temp.push(
            <div className="col-auto" key="builder.info.noSituationals">
                <TranslatableText
                    className={styles.noSituationals}
                    identifier="builder.info.noSituationals"
                ></TranslatableText>
            </div>
        );
    }
    return temp;
}

function cleanDescription(desc) {
    return (
        String(desc || '')
            // Section bullets (▶ ▪ ● • ◆ ★ ☆) become line breaks.
            .replace(/[\u25B6\u25AA\u25CF\u2022\u25A0\u25C6\u2605\u2606]/g, '\n')
            // Drop leftover icons and empty parens left behind by them.
            .replace(/[\u{1F5E1}]/gu, '')
            .replace(/\(\s*\)/g, '')
            .split('\n')
            .map((line) => line.replace(/^[\u25C6\u00B7\u2013\u2014\s]+/, '').trim())
            // Key-press hint lines ("Trigger: key.use while Sneaking") are
            // redundant next to the checkbox titles.
            .filter((line) => !/^Trigger:/i.test(line))
            .filter(Boolean)
            .join('\n')
    );
}

// Replaces #{Common|Uncommon|...} templates in CZ/Depths ability descriptions
// with the value for the Twisted level - rarity is gone, everything is Twisted.
function formatCzDescription(desc, t) {
    const KEYBINDS = {
        'key.attack': t('builder.keybinds.leftButton'),
        'key.use': t('builder.keybinds.rightButton'),
        'key.swapOffhand': t('builder.keybinds.swap'),
        'key.drop': t('builder.keybinds.drop'),
    };
    return String(desc || '')
        .replace(/#\{([^}]+)\}/g, (match, group) => {
            const values = group.split('|');
            const v = values[values.length - 1];
            return v === undefined ? match : v;
        })
        .replace(/key\.\w+/g, (match) => KEYBINDS[match] || match);
}

// The trees listed on the Celestial Zenith abilities wiki page.
const CZ_MAIN_TREES = [
    'Dawnbringer',
    'Earthbound',
    'Flamecaller',
    'Frostborn',
    'Shadowdancer',
    'Steelsage',
    'Windwalker',
    'Prismatic',
];

// Resource-pack icons: class/spec skills live in images/skills (unofficial
// mod textures where available - those are transparent), CZ abilities in
// images/cz. Both are keyed by the snake_case of the skill name.
const toSnakeName = (name) =>
    String(name || '')
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/'/g, '');
const skillIconSrc = (name) => `/images/skills/${toSnakeName(name)}.png`;
const czIconSrc = (name) => `/images/cz/${toSnakeName(name)}.png`;

// Current health slider + number box. This lives in its own component and
// keeps both inputs uncontrolled: dragging the slider updates the native
// input and its CSS variables directly, so the (very large) builder form only
// re-renders - and the stats only recalculate - once the value is released.
function HealthControls({ value, onSchedule, onCommit, currentHealth, healthFinal }) {
    const t = useTranslation();
    const sliderRef = React.useRef(null);
    const numberRef = React.useRef(null);

    const clamp = (raw) => {
        const n = Number(raw);
        return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 100));
    };

    // Parent-driven changes (restoring a build, reset, basic infusions) push
    // the value down into the native inputs.
    React.useEffect(() => {
        const v = clamp(value);
        for (const el of [sliderRef.current, numberRef.current]) {
            if (el && el.value !== String(v)) el.value = String(v);
        }
        if (sliderRef.current) {
            sliderRef.current.style.setProperty('--slider-color', `hsl(${(v / 100) * 120} 70% 45%)`);
            sliderRef.current.style.setProperty('--slider-pct', `${v}%`);
        }
    }, [value]);

    function handleInput(event) {
        const v = clamp(event.target.value);
        const el = sliderRef.current;
        if (el) {
            el.style.setProperty('--slider-color', `hsl(${(v / 100) * 120} 70% 45%)`);
            el.style.setProperty('--slider-pct', `${v}%`);
        }
        onSchedule();
    }

    function commit(event) {
        onCommit(String(clamp(event.target.value)));
    }

    function submitOnEnter(event) {
        if (event.key === 'Enter') event.currentTarget.blur();
    }

    return (
        <div className="text-center mx-2">
            <div className={styles.enchantTooltip}>
                <p className="mb-1">
                    <TranslatableText identifier="builder.misc.maxHealthPercent"></TranslatableText>
                </p>
                <span className={styles.enchantTooltipText}>{t('builder.misc.maxHealthPercentTooltip')}</span>
            </div>
            <div className={styles.healthSliderRow}>
                <input
                    ref={sliderRef}
                    type="range"
                    name="health"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue={clamp(value)}
                    onChange={handleInput}
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                    className={styles.healthSlider}
                />
                <input
                    ref={numberRef}
                    type="number"
                    name="health"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue={clamp(value)}
                    onChange={handleInput}
                    onBlur={commit}
                    onKeyDown={submitOnEnter}
                    className={styles.healthPercentInput}
                    aria-label={t('builder.misc.maxHealthPercentAria')}
                />
                <span className={styles.healthPoints}>
                    {Number.isFinite(currentHealth) ? Math.round(currentHealth) : '–'}
                    {' / '}
                    {Number.isFinite(healthFinal) ? Math.round(healthFinal) : '–'}
                </span>
            </div>
        </div>
    );
}

export default function BuildForm({
    update,
    build,
    savedState,
    savedName,
    notes,
    canEditNotes,
    buildId,
    revision,
    canPublicise,
    isPublic,
    isAnonymous,
    sharedSet,
    parentLoaded,
    itemData,
    itemsToDisplay,
    buildNameRef,
}) {
    const t = useTranslation();
    const regions = [
        { value: 1, label: t('builder.regions.valley') },
        { value: 2, label: t('builder.regions.isles') },
        { value: 3, label: t('builder.regions.ring') },
        { value: 'dd', label: t('builder.regions.darkestDepths') },
        { value: 'cz', label: t('builder.regions.celestialZenith') },
    ];
    const [stats, setStats] = React.useState({});
    const [charms, setCharms] = React.useState([]);
    const { favouriteSet } = useItemFavourites();
    const { enabled: maxMasterworkDefault } = useMaxMasterwork();
    const [gameClass, setGameClass] = React.useState('none'); // "class" is a reserved word
    const [skillsData, setSkillsData] = React.useState(null);
    const [skillPoints, setSkillPoints] = React.useState({});
    const [saveState, setSaveState] = React.useState(null); // 'saving' | 'copied' | 'error' | 'duplicate'
    const [savedAnonymous, setSavedAnonymous] = React.useState(false);
    // The DB row this build was opened from / saved to; edits update it in
    // place instead of spawning a new link.
    const [activeBuildId, setActiveBuildId] = React.useState(buildId || null);
    // Revision of the saved row this page is based on. Drafts record it so a
    // draft made against an older revision is ignored - opening a link always
    // shows the latest saved build, never locally cached older edits.
    const [buildRevision, setBuildRevision] = React.useState(Number(revision) || 1);
    const [loggedIn, setLoggedIn] = React.useState(null); // null = checking
    const [notesDraft, setNotesDraft] = React.useState(notes || '');
    const [notesSaveState, setNotesSaveState] = React.useState(null); // 'saving' | 'saved' | 'error'
    const [publicState, setPublicState] = React.useState({
        isPublic: Boolean(isPublic),
        anonymous: Boolean(isAnonymous),
    });
    const [publiciseState, setPubliciseState] = React.useState(null); // null | 'saving' | 'error' | 'profanity'
    const [ownsBuild, setOwnsBuild] = React.useState(Boolean(canPublicise));
    const [favState, setFavState] = React.useState(null); // null | {favourite, count}
    const [favBusy, setFavBusy] = React.useState(false);
    const [resetConfirm, setResetConfirm] = React.useState(false);
    const resetTimeoutRef = React.useRef(null);
    const [statInputs, setStatInputs] = React.useState(DEFAULT_STAT_INPUTS);
    const [regionValue, setRegionValue] = React.useState(3);
    const [regionSelectKey, setRegionSelectKey] = React.useState(0);
    const [enhancements, setEnhancements] = React.useState({}); // buff key -> true
    const [spec, setSpec] = React.useState(null); // specialization name
    const [specSkillPoints, setSpecSkillPoints] = React.useState({});
    const [czAbilities, setCzAbilities] = React.useState({}); // ability name -> selected (always Twisted)
    const [czData, setCzData] = React.useState(null);
    const [czOpen, setCzOpen] = React.useState(false);
    const [czSelectedTree, setCzSelectedTree] = React.useState(CZ_MAIN_TREES[0]);
    const [charmStatsOpen, setCharmStatsOpen] = React.useState(false);
    const [delveOpen, setDelveOpen] = React.useState(false);
    const [delveInfusions, setDelveInfusions] = React.useState({}); // slot -> infusion name (always level IV)
    // Basic (normal) infusions: one per item, levels I-IV (Tenacity, Vitality,
    // Vigor, Focus, Perspicacity, Acumen - see data/basicInfusions.js).
    const [basicOpen, setBasicOpen] = React.useState(false);
    const [basicInfusions, setBasicInfusions] = React.useState({}); // slot -> { name, level }
    // Which normal-infusion inputs to show (Settings -> Infusion inputs):
    // 'item' = per-slot pickers only, 'total' = the number boxes only,
    // 'both' = both. Read in an effect so the first render matches the server.
    const [infusionInputMode, setInfusionInputMode] = React.useState('both');
    // Delve infusion levels: one per slot, I-IV. Picking an infusion defaults
    // its level to IV. Six slots at level IV is the 24-point total the delve
    // budget allows, so a per-slot cap of 4 alone can never exceed it.
    const DELVE_POINT_DEFAULT = 4;
    const DELVE_POINT_MAX_PER_SLOT = 4;
    const [delvePoints, setDelvePoints] = React.useState({});
    const [revelation, setRevelation] = React.useState(false);
    const [charmSelectKey, setCharmSelectKey] = React.useState(0);
    const [multiplierListKey, setMultiplierListKey] = React.useState(0);
    // The Extra Multipliers section is collapsed behind a toggle by default;
    // the five ListSelectors stay mounted while hidden so their typed entries
    // survive closing and reopening the section.
    const [multipliersOpen, setMultipliersOpen] = React.useState(false);
    // Big red-x shown on top of the page when filtered words are typed into
    // the build name or notes; the words themselves are stripped.
    const [showRedX, setShowRedX] = React.useState(false);
    const redXTimeoutRef = React.useRef(null);
    // Portal tooltip for delve infusion options: the dropdown menu scrolls,
    // so an absolutely-positioned tooltip inside it would be clipped. This
    // one renders on document.body, always on top.
    const [tip, setTip] = React.useState(null); // { left, top, info }
    // Saved skill/delve sets modal ("copy skills from a build" + apply saved
    // sets); opened by the "Skill sets" button under the import bar.
    const [setsOpen, setSetsOpen] = React.useState(false);
    // While the dialog is open: lock the page behind it (touch scroll would
    // otherwise chain to the builder) and let Escape close it.
    React.useEffect(() => {
        if (!setsOpen) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') setSetsOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [setsOpen]);
    // Phones fold the region/class/spec cluster and the import/skill-set
    // cluster into collapsible dropdowns (the inline rows don't fit).
    const [regionClassOpen, setRegionClassOpen] = React.useState(false);
    const [importOpen, setImportOpen] = React.useState(false);

    function triggerRedX() {
        setShowRedX(true);
        if (redXTimeoutRef.current) clearTimeout(redXTimeoutRef.current);
        redXTimeoutRef.current = setTimeout(() => setShowRedX(false), 1600);
    }

    function setBuildNameFiltered(value) {
        const { cleaned, found } = filterBadWords(String(value ?? ''));
        if (found) triggerRedX();
        // Header commits only update the ref: no state change, no re-render.
        buildNameRef.current = cleaned || 'Monumenta Builder';
        // The draft must follow the name even though nothing re-rendered:
        // otherwise reopening the build restores the cached older name.
        scheduleDraftSave();
    }

    // Programmatic name changes (draft restore, reset) bump a signal so the
    // header re-reads the ref; typing in the header never re-renders the form.
    const [nameSignal, setNameSignal] = React.useState(0);
    function applyBuildName(name) {
        buildNameRef.current = name || 'Monumenta Builder';
        setNameSignal((v) => v + 1);
    }
    const [draft, setDraft] = React.useState(null); // restored session draft, if any

    // Read the session draft once on mount (localStorage is not available
    // during SSR, and reading it in a render would break hydration). Skipped
    // when the "Cache builds" setting is off.
    React.useEffect(() => {
        if (!isBuildsCacheEnabled()) return;
        try {
            const raw = window.localStorage.getItem(DRAFT_KEY);
            if (raw) setDraft(JSON.parse(raw));
        } catch (e) {}
    }, []);

    React.useEffect(() => {
        setInfusionInputMode(getInfusionInputMode());
    }, []);

    // Which draft applies to this page:
    //  - plain /builder: only an unsaved build's draft, so opening the builder
    //    to start something new never loads the last saved build you had open;
    //  - saved-build page: only that build's own draft, and only when the
    //    draft was made against the row's current revision. A draft based on
    //    an older revision loses to the saved build, so opening a shared link
    //    (old ?v= links redirect to the latest revision) shows the latest.
    const effectiveDraft = React.useMemo(() => {
        if (!draft) return null;
        if (build) {
            return draft.buildId && draft.buildId === buildId && Number(draft.revision) === Number(buildRevision)
                ? draft
                : null;
        }
        return draft.buildId ? null : draft;
    }, [draft, build, buildId, buildRevision]);

    // A draft for this build that does not match the row's current revision is
    // stale (the build was updated elsewhere, or the link pointed at an older
    // revision). Drop it from localStorage so no old edits linger; the
    // autosave then stores the freshly loaded build instead.
    React.useEffect(() => {
        if (!draft || !build || draft.buildId !== buildId) return;
        if (Number(draft.revision) !== Number(buildRevision)) {
            try {
                window.localStorage.removeItem(DRAFT_KEY);
            } catch (e) {}
            setDraft(null);
        }
    }, [draft, build, buildId, buildRevision]);

    // Drag-to-reorder of skill/ability lists. dragState drives styling; the
    // ref holds the in-flight drag so handlers never read stale state.
    // dragTarget tracks which row the pointer is over (drop highlight).
    const [dragState, setDragState] = React.useState(null); // { container, key }
    const dragStateRef = React.useRef(null);
    const [dragTarget, setDragTarget] = React.useState(null); // { container, key }
    const dragTargetRef = React.useRef(null);
    const [orderVersion, setOrderVersion] = React.useState(0);

    function startSkillDrag(container, key, e) {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', `${container}:${key}`);
            e.dataTransfer.effectAllowed = 'move';
            // Custom drag image: a ghost copy of the whole row (the default
            // is just the tiny handle, which feels unresponsive).
            const handle = e.currentTarget;
            const row = handle.closest(`.${styles.skillRow}`) || handle;
            if (row) {
                const ghost = row.cloneNode(true);
                ghost.style.position = 'fixed';
                ghost.style.left = '-9999px';
                ghost.style.top = '-9999px';
                ghost.style.width = `${row.offsetWidth}px`;
                ghost.style.pointerEvents = 'none';
                ghost.style.opacity = '0.85';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 24, 18);
                requestAnimationFrame(() => ghost.remove());
            }
        }
        dragStateRef.current = { container, key };
        dragTargetRef.current = null;
        setDragState({ container, key });
        setDragTarget(null);
    }

    function endSkillDrag() {
        dragStateRef.current = null;
        dragTargetRef.current = null;
        setDragState(null);
        setDragTarget(null);
    }

    // On drag-over a row in the same container, move the dragged item to that
    // row's slot and persist the new order (triggers a re-render via orderVersion).
    function skillDragOver(e, container, key, sortedList, keyOf) {
        const d = dragStateRef.current;
        if (!d || d.container !== container) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Highlight the row currently under the pointer.
        if (dragTargetRef.current?.key !== key) {
            dragTargetRef.current = { container, key };
            setDragTarget({ container, key });
        }
        if (d.key !== key) {
            const next = moveInOrder(sortedList, keyOf, d.key, key);
            writeOrder(container, next.map(keyOf));
            setOrderVersion((v) => v + 1);
        }
        // Auto-scroll the page while hovering near its edges.
        const MARGIN = 80;
        if (e.clientY < MARGIN) window.scrollBy(0, -18);
        else if (e.clientY > window.innerHeight - MARGIN) window.scrollBy(0, 18);
    }

    function skillDragLeave(key) {
        if (dragTargetRef.current?.key === key) {
            dragTargetRef.current = null;
            setDragTarget(null);
        }
    }

    // Called by HealthControls once the slider/number box is released or the
    // field is left: mirror the settled value into state and rebuild now.
    function commitHealthInput(value) {
        setStatInputs((prev) => ({ ...prev, health: value }));
        // Deferred so React has committed the clamped value to the DOM before
        // the rebuild reads the form (typing 150 must calculate with 100).
        setTimeout(() => flushStatsRecalc(), 0);
    }

    // The Stats rebuild is synchronous and heavy, so the health slider and the
    // tenacity/vitality/... number inputs only recompute once the user stops
    // adjusting them. A trailing debounce keeps the CPU idle while the slider
    // is being dragged; releasing it (or blurring the field) runs the rebuild
    // a moment later.
    const STAT_RECALC_WINDOW = 150;
    const statRecalcTimerRef = React.useRef(null);

    function scheduleStatsRecalc() {
        if (statRecalcTimerRef.current) clearTimeout(statRecalcTimerRef.current);
        statRecalcTimerRef.current = setTimeout(() => {
            statRecalcTimerRef.current = null;
            // By the time this fires React has committed the new values to the
            // DOM, so re-reading the form is authoritative.
            recalcBuildStats();
        }, STAT_RECALC_WINDOW);
    }

    function flushStatsRecalc() {
        if (statRecalcTimerRef.current) {
            clearTimeout(statRecalcTimerRef.current);
            statRecalcTimerRef.current = null;
        }
        recalcBuildStats();
    }

    // --- Saved sets (panel API) ---

    // The snapshot the panel POSTs: the skill portion of the build, or the
    // delve infusions, as plain JSON.
    function getSnapshot(kind) {
        if (kind === 'skills') {
            if (gameClass === 'none') return null;
            return {
                cl: gameClass,
                sp: spec || null,
                sk: { ...skillPoints },
                ssk: { ...specSkillPoints },
                en: { ...enhancements },
                cz: { ...czAbilities },
            };
        }
        if (kind === 'delve') {
            return {
                infusions: { ...delveInfusions },
                points: { ...delvePoints },
                revelation: Boolean(revelation),
            };
        }
        return null;
    }

    // Replaces the class/spec/skills portion of the form with a snapshot
    // (from a saved set or another build). Returns an error string or null.
    function applySkillPayload(payload) {
        if (!payload || !payload.cl) return t('builder.sets.noClass');
        const sk = payload.sk && typeof payload.sk === 'object' ? { ...payload.sk } : {};
        const ssk = payload.ssk && typeof payload.ssk === 'object' ? { ...payload.ssk } : {};
        const en = payload.en && typeof payload.en === 'object' ? { ...payload.en } : {};
        const cz = payload.cz && typeof payload.cz === 'object' ? { ...payload.cz } : {};
        setGameClass(String(payload.cl).toLowerCase());
        const nextSpec = payload.sp ? String(payload.sp) : null;
        setSpec(nextSpec);
        setSkillPoints(sk);
        setSpecSkillPoints(ssk);
        setEnhancements(en);
        setCzAbilities(cz);
        setCzOpen(Object.keys(cz).length > 0);
        refreshClassBuffs(sk, ssk, en);
        return null;
    }

    // Replaces the delve infusions (and Revelation) with a delve snapshot.
    // Returns an error string or null.
    function applyDelvePayload(payload) {
        if (!payload || typeof payload !== 'object') return t('builder.sets.empty');
        const infusions = payload.infusions && typeof payload.infusions === 'object' ? { ...payload.infusions } : {};
        const points = payload.points && typeof payload.points === 'object' ? { ...payload.points } : {};
        setDelveInfusions(infusions);
        setDelvePoints(points);
        setRevelation(Boolean(payload.revelation));
        if (Object.keys(infusions).length > 0) setDelveOpen(true);
        // Recalculate the stats the same way a manual infusion pick does:
        // patch the form entries (the selects write their choices there) and
        // run one stats update.
        const entries = Array.from(new FormData(formRef.current).entries()).filter(
            ([key]) => !key.startsWith('delveInfusion-') && !key.startsWith('delveLevel-') && key !== 'revelation'
        );
        for (const [slot, value] of Object.entries(infusions)) {
            entries.push([`delveInfusion-${slot}`, value]);
            const level = points[slot] !== undefined ? points[slot] : 4;
            entries.push([`delveLevel-${slot}`, String(level)]);
        }
        for (const slot of ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots']) {
            if (!infusions[slot]) entries.push([`delveInfusion-${slot}`, 'None']);
        }
        if (payload.revelation) entries.push(['revelation', '1']);
        // The snapshot is being applied, so the section counts even if its
        // toggle was off (the toggle is re-enabled above when infusions exist).
        if (Object.keys(infusions).length > 0) entries.push(['delveEnabled', '1']);
        applyStatsUpdate(Object.fromEntries(entries), itemData, setStats, update);
        return null;
    }

    // "Copy skills" from another build: the caller's own saved builds carry
    // their token (decoded here), while public database builds are decoded by
    // the server (the token never leaves it) and fetched by id.
    async function copyBuildSkills(build) {
        if (!build) return t('builder.sets.couldNotReadBuild');
        let parsed = build.token ? skillsPayloadFromToken(build.token, itemData) : null;
        if (!parsed && build.id) {
            try {
                const res = await fetch(`/api/v2/builds/${encodeURIComponent(build.id)}/skills`);
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    parsed = data && data.payload ? data.payload : null;
                }
            } catch (e) {
                parsed = null;
            }
        }
        if (!parsed) return t('builder.sets.couldNotReadBuild');
        return applySkillPayload(parsed);
    }

    async function deleteSavedSet(id) {
        try {
            const res = await fetch(`/api/v2/skill-sets/${encodeURIComponent(id)}`, { method: 'DELETE' });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    function revelationChanged(event) {
        setRevelation(event.target.checked);
        // Native checkbox state is already in FormData at this point (see checkboxChanged).
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function delveChanged(slot, option) {
        setTip(null);
        setDelveInfusions((prev) => {
            const next = { ...prev };
            if (option) {
                next[slot] = option.value;
            } else {
                delete next[slot];
            }
            return next;
        });
        // Newly picked infusions default to level IV (4 points); clearing the
        // infusion drops its points too.
        if (option) {
            const defaultPoints = Math.min(
                DELVE_POINT_MAX_PER_SLOT,
                Math.max(delvePoints[slot] ?? 0, DELVE_POINT_DEFAULT)
            );
            setDelvePoints((prev) => ({ ...prev, [slot]: defaultPoints }));
        } else {
            setDelvePoints((prev) => {
                const next = { ...prev };
                delete next[slot];
                return next;
            });
        }
        // FormData is stale right after a Select change, so inject the new value
        // manually (same pattern as itemChanged) and recalculate.
        let entries = Array.from(new FormData(formRef.current).entries());
        for (let i = 0; i < entries.length; i++) {
            if (entries[i][0] == `delveInfusion-${slot}`) entries[i][1] = option ? option.value : 'None';
        }
        const itemNames = Object.fromEntries(entries);
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function delveSlotSelects(slot) {
        const hasItem = stats.itemNames && stats.itemNames[slot] && stats.itemNames[slot] !== 'None';
        const cur = delveInfusions[slot];
        // Only one of each infusion: already-picked infusions (on other slots)
        // are removed from this dropdown so they can't be duplicated.
        const pickedElsewhere = new Set(
            Object.entries(delveInfusions)
                .filter(([s]) => s !== slot)
                .map(([, name]) => name)
        );
        // All infusions are usable in every region (the region field in the
        // data only records where each infusion drops); only already-picked
        // infusions (on other slots) are excluded so they can't be duplicated.
        const infusionOpts = DELVE_INFUSIONS.filter((i) => !pickedElsewhere.has(i.name)).map((i) => ({
            value: i.name,
            label: i.name,
        }));
        // Menu options get a portal tooltip with the infusion's effect (the
        // menu scrolls, so an in-menu tooltip would be clipped at its edges).
        const InfusionOption = (props) => {
            const info = DELVE_INFUSIONS.find((i) => i.name === props.data.value);
            return (
                <components.Option {...props}>
                    <span
                        className={styles.enchantTooltip}
                        onMouseEnter={(e) => {
                            if (!info || !info.effect) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTip({ left: rect.left + rect.width / 2, top: rect.top - 6, info });
                        }}
                        onMouseLeave={() => setTip(null)}
                    >
                        {props.children}
                    </span>
                </components.Option>
            );
        };
        // The selected value in the control shows the same info as a plain
        // enchant-style tooltip (the control doesn't scroll, so no portal).
        const formatValueLabel = (opt) => {
            const info = DELVE_INFUSIONS.find((i) => i.name === opt.value);
            return (
                <span className={styles.enchantTooltip}>
                    {opt.label}
                    {info && info.effect && (
                        <span className={styles.enchantTooltipText}>
                            <span style={{ fontWeight: 600 }}>{info.name}</span>
                            <span style={{ display: 'block', marginTop: 3 }}>{info.effect}</span>
                        </span>
                    )}
                </span>
            );
        };
        // The level picker mirrors the basic infusion one: I-IV, one per slot.
        const levelOpts = BASIC_INFUSION_LEVEL_LABELS.slice(0, DELVE_POINT_MAX_PER_SLOT).map((label, i) => ({
            value: i + 1,
            label,
        }));
        const currentLevel = Math.min(Math.max(Number(delvePoints[slot]) || 0, 1), DELVE_POINT_MAX_PER_SLOT);
        return (
            <div className={styles.delveSlotRow}>
                <Select
                    instanceId={`delve-${slot}`}
                    name={`delveInfusion-${slot}`}
                    isDisabled={!hasItem}
                    isClearable
                    isSearchable
                    options={infusionOpts}
                    value={cur ? { value: cur, label: cur } : null}
                    onChange={(opt) => delveChanged(slot, opt)}
                    onMenuClose={() => setTip(null)}
                    placeholder={t('builder.infusions.placeholder')}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    theme={infusionSelectTheme}
                    styles={infusionSelectStyles}
                    components={{ Option: InfusionOption }}
                    formatOptionLabel={(opt, { context }) => (context === 'value' ? formatValueLabel(opt) : opt.label)}
                />
                {cur && (
                    <Select
                        instanceId={`delveLevel-${slot}`}
                        name={`delveLevel-${slot}`}
                        isSearchable={false}
                        options={levelOpts}
                        value={levelOpts.find((o) => o.value === currentLevel) || levelOpts[levelOpts.length - 1]}
                        onChange={(opt) => setDelvePoints((prev) => ({ ...prev, [slot]: opt.value }))}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={infusionSelectTheme}
                        styles={levelSelectStyles}
                        aria-label={`${cur} ${t('builder.infusions.level')}`}
                    />
                )}
            </div>
        );
    }

    // Basic (normal) infusions are per-slot picks ({ slot: { name, level } }),
    // one infusion per item at level I-IV. Six items at level IV is the
    // 24-level cap, so the items alone bound the totals.
    function basicChanged(slot, option) {
        setTip(null);
        if (!option) {
            commitInfusionChange(withoutSlot(basicInfusions, slot));
            return;
        }
        commitInfusionChange({
            ...basicInfusions,
            [slot]: { name: option.value, level: BASIC_INFUSION_MAX_LEVEL },
        });
    }

    function changeBasicLevel(slot, raw) {
        const wanted = Math.max(1, Math.min(BASIC_INFUSION_MAX_LEVEL, Number(raw) || 1));
        commitInfusionChange({ ...basicInfusions, [slot]: { ...basicInfusions[slot], level: wanted } });
    }

    // Normal infusions are per-slot picks ({ slot: { name, level } }): one
    // infusion per item, level I-IV. Six items at level IV is the 24-level
    // cap. `wantedByKey` maps a type (lowercased name) to the levels it asks
    // for; the resolver shares the items between every type that has levels,
    // picking the assignment that keeps each type's share of what it asked for
    // as large as possible, places the most levels, spreads the items evenly
    // between the types, then keeps their existing items (earlier items
    // first). Each type gets one item per level, so raising a total fills the
    // next item instead of stacking on the last one. Five levels of all six
    // types settle at four each on six items; levels no item can hold are
    // dropped, so every level the builder shows is on an item.
    function resolveBasicInfusions(wantedByKey, itemNames, picks = {}) {
        const slots = EQUIP_SLOTS.filter((slot) => itemNames && itemNames[slot] && itemNames[slot] !== 'None');
        const types = BASIC_INFUSIONS.map((infusion) => ({
            name: infusion.name,
            wanted: Math.max(
                0,
                Math.min(BASIC_INFUSION_LEVEL_CAP, Math.floor(Number(wantedByKey[infusion.name.toLowerCase()]) || 0))
            ),
        })).filter((type) => type.wanted > 0);
        const next = {};
        if (types.length === 0 || slots.length === 0) return next;

        // At most six items and six types, so the best item -> type assignment
        // is found by enumerating them all (7^6 candidates at worst).
        const counts = new Array(types.length).fill(0);
        // A type wants one item per level (a level I on every item as its
        // total grows), so it never needs more items than it has levels.
        const maxSlots = types.map((type) => Math.min(type.wanted, slots.length));
        const assigned = new Array(slots.length).fill(-1);
        let bestScore = null;
        let bestAssigned = null;

        const score = () => {
            let minShare = Infinity;
            let total = 0;
            let spread = Infinity;
            let retained = 0;
            let earliest = 0;
            for (let i = 0; i < types.length; i++) {
                const placed = Math.min(types[i].wanted, counts[i] * BASIC_INFUSION_MAX_LEVEL);
                minShare = Math.min(minShare, placed / types[i].wanted);
                total += placed;
                spread = Math.min(spread, counts[i]);
            }
            for (let i = 0; i < slots.length; i++) {
                if (assigned[i] < 0) continue;
                // Earlier items weigh more, so untouched types keep their
                // spread and new placements fill from the first item.
                const weight = slots.length - i;
                earliest += weight;
                if (picks[slots[i]]?.name === types[assigned[i]].name) retained += weight;
            }
            return [minShare, total, spread, retained, earliest];
        };

        const better = (candidate, current) => {
            if (!current) return true;
            for (let i = 0; i < candidate.length; i++) {
                if (candidate[i] > current[i] + 1e-9) return true;
                if (candidate[i] < current[i] - 1e-9) return false;
            }
            return false;
        };

        const walk = (index) => {
            if (index === slots.length) {
                const candidate = score();
                if (better(candidate, bestScore)) {
                    bestScore = candidate;
                    bestAssigned = [...assigned];
                }
                return;
            }
            // Slots may stay unused when no type wants what they would add.
            for (let type = -1; type < types.length; type++) {
                if (type >= 0 && counts[type] >= maxSlots[type]) continue;
                assigned[index] = type;
                if (type >= 0) counts[type]++;
                walk(index + 1);
                if (type >= 0) counts[type]--;
            }
            assigned[index] = -1;
        };
        walk(0);

        const slotsByType = types.map(() => []);
        bestAssigned.forEach((type, index) => {
            if (type >= 0) slotsByType[type].push(slots[index]);
        });
        types.forEach((type, index) => {
            const typeSlots = slotsByType[index];
            const placed = Math.min(type.wanted, typeSlots.length * BASIC_INFUSION_MAX_LEVEL);
            if (typeSlots.length === 0 || placed === 0) return;
            // Items the type already carries come first, so rebalances move as
            // few picks as possible.
            typeSlots.sort((a, b) => (picks[b]?.name === type.name ? 1 : 0) - (picks[a]?.name === type.name ? 1 : 0));
            // One level per item first, then a second level each, and so on:
            // raising the total fills the next item instead of stacking.
            const base = Math.floor(placed / typeSlots.length);
            const remainder = placed - base * typeSlots.length;
            typeSlots.forEach((slot, slotIndex) => {
                next[slot] = { name: type.name, level: base + (slotIndex < remainder ? 1 : 0) };
            });
        });
        return next;
    }

    // "Both" and "Number total" modes: the number box is the per-type total.
    // Editing it re-shares the items between every type that has levels (see
    // resolveBasicInfusions), so impossible combos cannot be entered - five
    // levels of all six infusions end at level IV each on six items - and the
    // box shows the placed sum, never a level no item carries. Editing a
    // picker updates the boxes the other way.
    function changeSyncedInfusion(key, raw) {
        const wanted = Math.max(0, Math.min(BASIC_INFUSION_LEVEL_CAP, Math.floor(Number(raw) || 0)));
        const wantedByKey = basicInfusionTotals(basicInfusions);
        wantedByKey[key] = wanted;
        commitInfusionChange(resolveBasicInfusions(wantedByKey, stats.itemNames, basicInfusions));
    }

    // Sum the infusion levels per type across all slots (the wiki allows one
    // basic infusion per item, so each type's total is just the sum of its
    // levels). These totals drive the stat calculations (Stats reads
    // formData.tenacity/vitality/vigor/focus/perspicacity), so they're
    // mirrored into statInputs, whose hidden inputs keep them in the form.
    function withoutSlot(map, slot) {
        const next = { ...map };
        delete next[slot];
        return next;
    }

    // Per-type sums of the per-slot basic infusion levels: what the stat
    // calculation and the saved token consume. Every infusion gets an entry
    // (Acumen included) so rebalances never drop a type.
    function basicInfusionTotals(infusions = basicInfusions) {
        const totals = {};
        for (const infusion of BASIC_INFUSIONS) totals[infusion.name.toLowerCase()] = 0;
        for (const { name, level } of Object.values(infusions)) {
            const key = name.toLowerCase();
            if (totals[key] !== undefined) totals[key] += level;
        }
        return totals;
    }

    // Push the per-slot picks into the form. The hidden inputs only commit on
    // the next render, so the fresh values are passed straight to the
    // recalculation (Understanding's amplifier counts per-slot picks).
    function commitInfusionChange(nextInfusions) {
        setBasicInfusions(nextInfusions);
        const totals = basicInfusionTotals(nextInfusions);
        const statTotals = {};
        for (const key of BASIC_INFUSION_STAT_KEYS) statTotals[key] = totals[key] || 0;
        setStatInputs((prev) => ({ ...prev, ...statTotals }));
        // FormData is stale right after a change, so inject the fresh values
        // manually (same pattern as delveChanged) and recalculate.
        const itemNames = Object.fromEntries(Array.from(new FormData(formRef.current).entries()));
        for (const slot of EQUIP_SLOTS) {
            itemNames[`basicInfusion-${slot}`] = nextInfusions[slot]?.name || 'None';
        }
        for (const key of BASIC_INFUSION_STAT_KEYS) itemNames[key] = String(totals[key] || 0);
        itemNames.basicInfusionCounts = JSON.stringify(basicInfusionCounts(nextInfusions));
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    // How many items carry each basic infusion type. Understanding's amplifier
    // applies per item, so the stat calculation needs the counts (two items
    // with Vitality II are 2 x (0.2 * level) extra levels, not one).
    function basicInfusionCounts(infusions) {
        const counts = {};
        for (const infusion of BASIC_INFUSIONS) counts[infusion.name.toLowerCase()] = 0;
        for (const { name } of Object.values(infusions)) {
            const key = name.toLowerCase();
            if (counts[key] !== undefined) counts[key] += 1;
        }
        return counts;
    }

    function basicSlotSelects(slot) {
        const hasItem = stats.itemNames && stats.itemNames[slot] && stats.itemNames[slot] !== 'None';
        const cur = basicInfusions[slot];
        // Regular infusions can be duplicated across items (unlike delve
        // infusions), so every slot offers the full list.
        const infusionOpts = BASIC_INFUSIONS.map((i) => ({
            value: i.name,
            label: i.name,
        }));
        const levelOpts = BASIC_INFUSION_LEVEL_LABELS.slice(0, BASIC_INFUSION_MAX_LEVEL).map((label, i) => ({
            value: i + 1,
            label,
        }));
        // Menu options get a portal tooltip with the infusion's effect (the
        // menu scrolls, so an in-menu tooltip would be clipped at its edges).
        const InfusionOption = (props) => {
            const info = BASIC_INFUSIONS.find((i) => i.name === props.data.value);
            return (
                <components.Option {...props}>
                    <span
                        className={styles.enchantTooltip}
                        onMouseEnter={(e) => {
                            if (!info || !info.effect) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTip({ left: rect.left + rect.width / 2, top: rect.top - 6, info });
                        }}
                        onMouseLeave={() => setTip(null)}
                    >
                        {props.children}
                    </span>
                </components.Option>
            );
        };
        const formatValueLabel = (opt) => {
            const info = BASIC_INFUSIONS.find((i) => i.name === opt.value);
            return (
                <span className={styles.enchantTooltip}>
                    {opt.label}
                    {info && info.effect && (
                        <span className={styles.enchantTooltipText}>
                            <span style={{ fontWeight: 600 }}>{info.name}</span>
                            <span style={{ display: 'block', marginTop: 3 }}>{info.effect}</span>
                        </span>
                    )}
                </span>
            );
        };
        return (
            <div className={styles.delveSlotRow}>
                <Select
                    instanceId={`basic-${slot}`}
                    name={`basicInfusion-${slot}`}
                    isDisabled={!hasItem}
                    isClearable
                    isSearchable
                    options={infusionOpts}
                    value={cur ? { value: cur.name, label: cur.name } : null}
                    onChange={(opt) => basicChanged(slot, opt)}
                    onMenuClose={() => setTip(null)}
                    placeholder={t('builder.infusions.placeholder')}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    theme={infusionSelectTheme}
                    styles={infusionSelectStyles}
                    components={{ Option: InfusionOption }}
                    formatOptionLabel={(opt, { context }) => (context === 'value' ? formatValueLabel(opt) : opt.label)}
                />
                {cur && (
                    <Select
                        instanceId={`basicLevel-${slot}`}
                        name={`basicLevel-${slot}`}
                        isSearchable={false}
                        options={levelOpts}
                        value={levelOpts.find((o) => o.value === cur.level) || levelOpts[levelOpts.length - 1]}
                        onChange={(opt) => changeBasicLevel(slot, opt.value)}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={infusionSelectTheme}
                        styles={levelSelectStyles}
                        aria-label={`${cur.name} ${t('builder.infusions.level')}`}
                    />
                )}
            </div>
        );
    }

    function regionChanged(newValue) {
        const raw = newValue ? newValue.value : null;
        // 'dd' = Darkest Depths (Isles' 12+), 'cz' = Celestial Zenith (Ring's 12+).
        const nextRegion = raw === 'dd' ? 2 : raw === 'cz' ? 3 : Number(raw);
        setRegionValue(nextRegion);
        setCzOpen(raw === 'dd' || raw === 'cz');

        // Region gating: Valley (1) has no specializations at all; neither do
        // the CZ/DD variants. Valley and Isles (1-2) have no enhancements or
        // charms. Depths abilities only exist in Darkest Depths (Isles) and
        // Celestial Zenith (Ring).
        let nextSpec = spec;
        let nextSpecPoints = specSkillPoints;
        let nextEnhancements = enhancements;
        let nextCharms = charms;
        let nextCz = czAbilities;
        const isCzDd = raw === 'dd' || raw === 'cz';
        if (nextRegion === 1 || isCzDd) {
            nextSpec = null;
            nextSpecPoints = {};
            setSpec(null);
            setSpecSkillPoints({});
        }
        if (nextRegion === 1) {
            nextCz = {};
            setCzAbilities({});
            setCzOpen(false);
        }
        if (nextRegion < 3) {
            nextEnhancements = {};
            nextCharms = [];
            setEnhancements({});
            setCharms([]);
        }
        if (nextRegion === 2) {
            // Prismatic is Celestial Zenith-only (not available in the Depths).
            nextCz = Object.fromEntries(
                Object.entries(nextCz).filter(
                    ([name]) =>
                        !czData?.trees?.some((t) => t.tree === 'Prismatic' && t.skills.some((s) => s.name === name))
                )
            );
            setCzAbilities(nextCz);
            if (czSelectedTree === 'Prismatic') {
                setCzSelectedTree(CZ_MAIN_TREES[0]);
            }
        }
        refreshClassBuffs(skillPoints, nextSpecPoints, nextEnhancements);
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    React.useEffect(() => {
        return () => {
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
            if (statRecalcTimerRef.current) clearTimeout(statRecalcTimerRef.current);
        };
    }, []);

    function handleResetClick() {
        if (!resetConfirm) {
            setResetConfirm(true);
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = setTimeout(() => setResetConfirm(false), 2500);
            return;
        }
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        setResetConfirm(false);
        resetForm();
    }

    // Memoized: returning a fresh [] on every render made every memo that
    // depends on these lists (the charm selector's whole option list) rebuild
    // on every keystroke/slider tick.
    const currentClassSkills = React.useMemo(() => {
        if (!skillsData || !Array.isArray(skillsData.classes) || gameClass == 'none') return [];
        const cls = skillsData.classes.find((c) => (c.className || '').toLowerCase() == gameClass);
        return cls ? cls.skills || [] : [];
    }, [skillsData, gameClass]);

    const currentSpecOptions = React.useMemo(() => {
        if (!skillsData || !Array.isArray(skillsData.classes) || gameClass == 'none') return [];
        const cls = skillsData.classes.find((c) => (c.className || '').toLowerCase() == gameClass);
        return (cls?.specs || []).map((s) => ({ value: s.specName, label: s.specName }));
    }, [skillsData, gameClass]);

    const currentSpecSkills = React.useMemo(() => {
        if (!skillsData || !Array.isArray(skillsData.classes) || gameClass == 'none' || !spec) return [];
        const cls = skillsData.classes.find((c) => (c.className || '').toLowerCase() == gameClass);
        const specData = cls?.specs?.find((s) => s.specName == spec);
        return specData ? specData.specSkills || [] : [];
    }, [skillsData, gameClass, spec]);

    // Stable name lists for the charm selector: it memoizes its option list
    // against these props, so freshly mapped arrays on every render made it
    // rebuild the whole charm list over and over.
    const charmNameList = React.useMemo(() => charms.map((c) => c.name), [charms]);
    const classSkillNameList = React.useMemo(() => currentClassSkills.map((s) => s.name), [currentClassSkills]);
    const specSkillNameList = React.useMemo(() => currentSpecSkills.map((s) => s.name), [currentSpecSkills]);

    // Rebuild the class-ability buff flags from skill points, spec skill
    // points, and the enhancement checkboxes. The stat engine reads these.
    function refreshClassBuffs(nextSkillPoints, nextSpecPoints, nextEnhancements) {
        Object.keys(enabledClassAbilityBuffs).forEach((key) => {
            enabledClassAbilityBuffs[key] = false;
        });
        for (const [id, pts] of Object.entries(nextSkillPoints)) {
            const buffKey = skillBuffKeys[id];
            if (!buffKey) continue;
            enabledClassAbilityBuffs[buffKey] = pts >= 1;
            enabledClassAbilityBuffs[`${buffKey}_lv1`] = pts >= 1;
            enabledClassAbilityBuffs[`${buffKey}_lv2`] = pts >= 2;
            enabledClassAbilityBuffs[`${buffKey}_lv3`] = pts >= 3;
        }
        for (const [id, pts] of Object.entries(nextSpecPoints)) {
            const buffKey = specSkillBuffKeys[id];
            if (!buffKey) continue;
            enabledClassAbilityBuffs[`${buffKey}_lv1`] = pts >= 1;
            enabledClassAbilityBuffs[`${buffKey}_lv2`] = pts >= 2;
            enabledClassAbilityBuffs[`${buffKey}_burst`] = pts >= 3;
        }
        for (const skillId of Object.keys(nextEnhancements)) {
            const buffKey = skillBuffKeys[skillId];
            if (!buffKey) continue;
            if ((nextSkillPoints[skillId] || 0) >= 1) {
                enabledClassAbilityBuffs[`${buffKey}_enhancement`] = true;
            }
        }
    }

    function recalcBuildStats(statOverrides) {
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        if (statOverrides) {
            for (const [key, value] of Object.entries(statOverrides)) {
                itemNames[key] = value;
            }
        }
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function skillPointClicked(skillId, pointIndex) {
        const current = skillPoints[skillId] || 0;
        const want = pointIndex + 1;
        const next = current === want ? pointIndex : want;
        const nextPoints = { ...skillPoints, [skillId]: next };
        if (next === 0) delete nextPoints[skillId];
        setSkillPoints(nextPoints);
        // Enhancements require at least one point in the skill.
        let nextEnhancements = enhancements;
        if (next === 0 && enhancements[skillId]) {
            nextEnhancements = { ...enhancements };
            delete nextEnhancements[skillId];
            setEnhancements(nextEnhancements);
        }
        refreshClassBuffs(nextPoints, specSkillPoints, nextEnhancements);
        recalcBuildStats();
    }

    function specSkillPointClicked(skillId, pointIndex) {
        const current = specSkillPoints[skillId] || 0;
        const want = pointIndex + 1;
        const next = current === want ? pointIndex : want;
        const nextPoints = { ...specSkillPoints, [skillId]: next };
        if (next === 0) delete nextPoints[skillId];
        setSpecSkillPoints(nextPoints);
        refreshClassBuffs(skillPoints, nextPoints, enhancements);
        recalcBuildStats();
    }

    function setAllSkillPoints(points) {
        const next = {};
        let nextEnhancements = enhancements;
        if (!points) {
            nextEnhancements = {};
        }
        currentClassSkills.forEach((skill) => {
            const maxPoints = Math.max(0, (skill.descriptions || []).length - 1);
            if (points && maxPoints > 0) next[skill.scoreboardId] = maxPoints;
        });
        setSkillPoints(next);
        if (!points) setEnhancements({});
        refreshClassBuffs(next, specSkillPoints, nextEnhancements);
        recalcBuildStats();
    }

    function enhancementToggled(skillId, checked) {
        // Enhancing a skill requires at least one point in it.
        if (checked && (skillPoints[skillId] || 0) < 1) return;
        const next = { ...enhancements };
        if (checked) next[skillId] = true;
        else delete next[skillId];
        setEnhancements(next);
        refreshClassBuffs(skillPoints, specSkillPoints, next);
        recalcBuildStats();
    }

    function specChanged(newValue, actionMeta) {
        const specName = newValue ? newValue.value : null;
        setSpec(specName);
        setSpecSkillPoints({});
        refreshClassBuffs(skillPoints, {}, enhancements);
        recalcBuildStats();
    }

    function czChanged(abilityName, checked) {
        // checked true selects; false deselects. Abilities are always Twisted.
        const next = { ...czAbilities };
        if (checked) next[abilityName] = true;
        else delete next[abilityName];
        setCzAbilities(next);
    }

    function clearCz() {
        setCzAbilities({});
    }

    // Save the current build. Opening a saved build (or having saved one this
    // session) updates that row in place - same link, name and notes included.
    // A fresh build POSTs and moves onto its new short link.
    React.useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                setLoggedIn(Boolean(d && d.user));
                // The account-wide anonymity preference from the top-right
                // settings menu is the default for every build: new ones start
                // with it, existing ones follow it too unless they are already
                // anonymous (mod uploads cannot know the preference, so their
                // row flag stays 0). The checkbox below is the explicit
                // per-build override.
                if (d && d.user) {
                    setPublicState((prev) => ({
                        ...prev,
                        anonymous: Boolean(d.user.anonymous) || (Boolean(activeBuildId) && prev.anonymous),
                    }));
                }
            })
            .catch(() => setLoggedIn(false));
    }, []);

    // Favourite state for the build page heart (public builds only).
    React.useEffect(() => {
        if (!activeBuildId || !publicState.isPublic) return;
        fetch(`/api/v2/builds/${activeBuildId}/favourite`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d) setFavState({ favourite: Boolean(d.favourite), count: d.count });
            })
            .catch(() => {});
    }, [activeBuildId, publicState.isPublic]);

    function setPublicVisibility(nextPublic, nextAnonymous) {
        if (!activeBuildId || publiciseState === 'saving') return;
        setPubliciseState('saving');
        let profanityHit = false;
        fetch(`/api/v2/builds/${activeBuildId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicise: nextPublic, anonymous: nextAnonymous }),
        })
            .then(async (r) => {
                if (r.status === 400) {
                    const data = await r.json().catch(() => null);
                    if (data && data.error === 'profanity') {
                        profanityHit = true;
                        setPubliciseState('profanity');
                        setTimeout(() => setPubliciseState(null), 5000);
                        throw new Error('profanity');
                    }
                }
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then((d) => {
                setPublicState({ isPublic: d.isPublic, anonymous: d.anonymous });
                setPubliciseState(null);
                if (!d.isPublic) setFavState(null);
            })
            .catch(() => {
                if (!profanityHit) {
                    setPubliciseState('error');
                    setTimeout(() => setPubliciseState(null), 5000);
                }
            });
    }

    // Before the build is saved (no activeBuildId yet) the publicise/anonymity
    // choices are local state that rides along on the next save.
    function togglePublic() {
        if (activeBuildId) {
            setPublicVisibility(!publicState.isPublic, publicState.anonymous);
            return;
        }
        setPublicState((prev) => ({ ...prev, isPublic: !prev.isPublic }));
    }

    function toggleAnonymous(event) {
        const next = Boolean(event.target.checked);
        if (activeBuildId) {
            setPublicVisibility(true, next);
            return;
        }
        setPublicState((prev) => ({ ...prev, anonymous: next }));
    }

    function toggleFavourite() {
        if (!activeBuildId || !publicState.isPublic || favBusy) return;
        // Only signed-in Discord users may like builds; the server enforces
        // this too (401). Without a session the button does nothing.
        if (!loggedIn) return;
        setFavBusy(true);
        const isFav = favState ? favState.favourite : false;
        fetch(`/api/v2/builds/${activeBuildId}/favourite`, { method: isFav ? 'DELETE' : 'POST' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => setFavState({ favourite: d.favourite, count: d.count }))
            .catch(() => {})
            .finally(() => setFavBusy(false));
    }

    function saveBuildToServer(forking = false) {
        const token = makeBuildString();
        const tokenVersion = getBuildTokenVersion(token) ?? '';
        // Someone else's saved build: sharing it must share the build as it
        // is. Saving would fork a copy onto the account, and the embed would
        // credit whoever shared it instead of the build's original author.
        // Saving the current edits as a copy is what "Save as new copy" does.
        if (activeBuildId && !forking && !ownsBuild) {
            const storedVersion = getBuildTokenVersion(build) ?? tokenVersion;
            const link =
                window.location.origin + getStsBase() + `/b/v${storedVersion}/${activeBuildId}` + `?v=${buildRevision}`;
            setSaveState('copied');
            setSavedAnonymous(false);
            if (navigator.clipboard) {
                navigator.clipboard.writeText(link).catch(() => {});
            }
            setTimeout(() => setSaveState(null), 4000);
            return Promise.resolve(link);
        }
        const payload = {
            token,
            infusions: delveInfusions,
            basicInfusions,
            revelation,
            name: buildNameRef.current !== 'Monumenta Builder' ? buildNameRef.current : null,
            notes: notesDraft.trim() ? notesDraft : null,
        };
        // Signed-in users can publicise / post anonymously straight from the
        // save button; the flags ride along with the save.
        if (loggedIn) {
            payload.publicise = publicState.isPublic;
            payload.anonymous = publicState.anonymous;
        }
        let profanityHit = false;
        let duplicateHit = false;

        // The account's own build is updated in place; an explicit fork (or an
        // unsaved build) POSTs a fresh snapshot link instead.
        if (activeBuildId && !forking && loggedIn) {
            setSaveState('saving');
            setSavedAnonymous(false);
            return fetch(`/api/v2/builds/${activeBuildId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: { token, infusions: delveInfusions, basicInfusions, revelation },
                    name: payload.name,
                    notes: payload.notes,
                    ...(loggedIn ? { publicise: publicState.isPublic, anonymous: publicState.anonymous } : {}),
                }),
            })
                .then(async (r) => {
                    // 403 = this build belongs to someone else (or an
                    // anonymous build we didn't create): fork it into a new
                    // build instead of overwriting theirs.
                    if (r.status === 403) return saveBuildToServer(true);
                    if (r.status === 400) {
                        const data = await r.json().catch(() => null);
                        if (data && data.error === 'profanity') {
                            profanityHit = true;
                            setPubliciseState('profanity');
                            setTimeout(() => setPubliciseState(null), 5000);
                            throw new Error('profanity');
                        }
                    }
                    if (r.status === 409) {
                        duplicateHit = true;
                        setSaveState('duplicate');
                        setTimeout(() => setSaveState(null), 6000);
                        throw new Error('duplicate');
                    }
                    if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
                    return r.json();
                })
                .then((result) => {
                    if (typeof result === 'string') return result; // fork already completed
                    // The row got saved to (or claimed onto) the signed-in
                    // account: reveal the publicise/anonymity options.
                    if (result.savedToAccount) setOwnsBuild(true);
                    // The server may have appended " (2)" to a duplicate name.
                    if (result.name && result.name !== buildNameRef.current) applyBuildName(result.name);
                    // Track the new revision so the draft saved next belongs to
                    // the row's current revision (older drafts are ignored).
                    if (result.version) setBuildRevision(result.version);
                    // The server returns the build's revision (?v=), which
                    // only changes when the build is updated.
                    const link =
                        window.location.origin +
                        getStsBase() +
                        `/b/v${tokenVersion}/${activeBuildId}` +
                        (result.version ? `?v=${result.version}` : '');
                    setSaveState('copied');
                    setSavedAnonymous(false);
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(link).catch(() => {});
                    }
                    setTimeout(() => setSaveState(null), 4000);
                    return link;
                })
                .catch(() => {
                    if (!profanityHit && !duplicateHit) {
                        setSaveState('error');
                        throw new Error('save failed');
                    }
                    if (duplicateHit) throw new Error('duplicate');
                });
        }

        setSaveState('saving');
        setSavedAnonymous(false);
        return fetch('/api/v2/builds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then(async (r) => {
                if (r.status === 400) {
                    const data = await r.json().catch(() => null);
                    if (data && data.error === 'profanity') {
                        profanityHit = true;
                        setPubliciseState('profanity');
                        setTimeout(() => setPubliciseState(null), 5000);
                        throw new Error('profanity');
                    }
                }
                if (r.status === 409) {
                    duplicateHit = true;
                    setSaveState('duplicate');
                    setTimeout(() => setSaveState(null), 6000);
                    throw new Error('duplicate');
                }
                if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
                return r.json();
            })
            .then((d) => {
                // The server returns the build's revision (?v=), which only
                // changes when the build is updated.
                const link = window.location.origin + getStsBase() + d.url + (d.version ? `?v=${d.version}` : '');
                // Remember the row so later edits update it instead of forking.
                setActiveBuildId(d.id);
                if (d.version) setBuildRevision(d.version);
                if (d.savedToAccount) setOwnsBuild(true);
                // The server may have appended " (2)" to a duplicate name.
                if (d.name && d.name !== buildNameRef.current) applyBuildName(d.name);
                // Move the address bar onto the build itself: a reload (or
                // sharing the tab) keeps you on the saved build. replaceState,
                // not pushState, so Back doesn't return to the blank builder.
                window.history.replaceState(null, '', getStsBase() + d.url);
                setSaveState('copied');
                if (d.savedToAccount) {
                    setSavedAnonymous(false);
                } else {
                    setSavedAnonymous(true);
                    setTimeout(() => setSavedAnonymous(false), 7000);
                }
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(link).catch(() => {});
                }
                setTimeout(() => setSaveState(null), 4000);
                return link;
            })
            .catch(() => {
                if (!profanityHit && !duplicateHit) {
                    setSaveState('error');
                    throw new Error('save failed');
                }
                if (duplicateHit) throw new Error('duplicate');
            });
    }

    function copyBuildDiscord(event) {
        saveBuildToServer()
            .then((link) => {
                event.target.value = t('common.copied');
                event.target.classList.add('fw-bold');
                setTimeout(() => {
                    event.target.value = t('builder.buttons.copyLinkForDiscord');
                    event.target.classList.remove('fw-bold');
                }, 3000);
                if (!navigator.clipboard) {
                    window.alert(t('builder.errors.clipboardCopyFailed'));
                    return;
                }
                const classLabel = gameClass != 'none' ? gameClass.charAt(0).toUpperCase() + gameClass.slice(1) : null;
                const regionLabel =
                    czOpen && regionValue === 2
                        ? t('builder.regions.darkestDepths')
                        : czOpen && regionValue === 3
                          ? t('builder.regions.celestialZenith')
                          : `R${regionValue}`;
                const tempBuildName =
                    buildNameRef.current && buildNameRef.current != 'Monumenta Builder'
                        ? buildNameRef.current
                        : classLabel
                          ? `${regionLabel} ${spec || classLabel} ${t('builder.misc.build')}`
                          : 'Monumenta Builder';
                navigator.clipboard.writeText(`[${tempBuildName}](${link})`).then(
                    function () {
                        console.log('Copying to clipboard was successful!');
                    },
                    function (err) {
                        console.error('Could not copy text: ', err);
                    }
                );
            })
            .catch(() => {});
    }

    function saveNotes() {
        if (!activeBuildId) return;
        setNotesSaveState('saving');
        fetch(`/api/v2/builds/${activeBuildId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: notesDraft }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => {
                setNotesSaveState('saved');
                setTimeout(() => setNotesSaveState(null), 2500);
            })
            .catch(() => setNotesSaveState('error'));
    }

    React.useEffect(() => {
        loadSkills()
            .then((d) => {
                if (d && Array.isArray(d.classes)) setSkillsData(d);
            })
            .catch(() => {});
    }, []);

    React.useEffect(() => {
        loadCz()
            .then((d) => {
                if (d && Array.isArray(d.trees)) setCzData(d);
            })
            .catch(() => {});
    }, []);

    // Prismatic abilities only exist in Celestial Zenith (Ring); drop them when
    // planning a Darkest Depths (Isles) build, once the data is known.
    React.useEffect(() => {
        if (!czData || regionValue !== 2 || Object.keys(czAbilities).length === 0) return;
        const prismaticNames = new Set(
            czData.trees.find((t) => t.tree === 'Prismatic')?.skills.map((s) => s.name) || []
        );
        const next = Object.fromEntries(Object.entries(czAbilities).filter(([name]) => !prismaticNames.has(name)));
        if (Object.keys(next).length !== Object.keys(czAbilities).length) {
            setCzAbilities(next);
        }
    }, [czData, regionValue]);

    // Open the tree that actually contains the loaded abilities: a saved
    // Celestial Zenith / Darkest Depths build must show its own tree instead
    // of the default one. Only auto-switches when the current selection has
    // none of the loaded abilities, so manual tree picks stay intact.
    React.useEffect(() => {
        if (!czData || !czOpen || Object.keys(czAbilities).length === 0) return;
        const loadedNames = new Set(Object.keys(czAbilities));
        const hasAny = (t) => t.skills.some((s) => loadedNames.has(s.name));
        const currentHasAny = czSelectedTree ? czData.trees.some((t) => t.tree === czSelectedTree && hasAny(t)) : false;
        if (currentHasAny) return;
        const allowed = CZ_MAIN_TREES.filter((t) => !(regionValue === 2 && t === 'Prismatic'));
        const treeOf = czData.trees.find((t) => allowed.includes(t.tree) && hasAny(t));
        if (treeOf && treeOf.tree !== czSelectedTree) setCzSelectedTree(treeOf.tree);
    }, [czData, czOpen, czAbilities, regionValue]);

    function sendUpdate(event) {
        event.preventDefault();
        const itemNames = Object.fromEntries(new FormData(event.target).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    // Restoring the build (or the empty build's base stats) runs in a layout
    // effect and applies its stats immediately: both the stat cards and the
    // item slots are laid out from this state, so anything that lands after the
    // first paint grows the page a frame later and shifts everything below it -
    // the builder's largest CLS source. BuilderPage flips parentLoaded in a
    // layout effect too, so this still runs before the browser paints.
    React.useLayoutEffect(() => {
        if (!parentLoaded) return;
        // Source of truth for this page: the URL build (saved build), or the
        // session draft that belongs here (see effectiveDraft). A matching
        // draft wins over the URL: it may hold edits the user hasn't saved yet.
        const isLoadedBuild = Boolean(build);
        const effDraft = effectiveDraft;
        const loadToken = effDraft ? effDraft.token : build;
        if (!loadToken) {
            // Fresh builder (no build link, no draft): compute the empty build's
            // base stats right away so the stat cards are populated before any
            // edit instead of showing empty cards.
            applyStatsUpdateNow(
                Object.fromEntries(new FormData(formRef.current).entries()),
                itemData,
                setStats,
                update
            );
            return;
        }
        const decoded = decodeBuildParam(loadToken, itemData);
        if (!decoded) return;
        let buildParts = decodeURI(decoded).split('&');
        let itemNames = {
            mainhand: buildParts.find((str) => str.includes('m='))?.split('m=')[1],
            offhand: buildParts.find((str) => str.includes('o='))?.split('o=')[1],
            helmet: buildParts.find((str) => str.includes('h='))?.split('h=')[1],
            chestplate: buildParts.find((str) => str.includes('c='))?.split('c=')[1],
            leggings: buildParts.find((str) => str.includes('l='))?.split('l=')[1],
            boots: buildParts.find((str) => str.includes('b='))?.split('b=')[1],
        };
        Object.keys(itemNames).forEach((type) => {
            if (itemNames[type] === undefined || !Object.keys(itemData).includes(itemNames[type])) {
                itemNames[type] = 'None';
            }
        });
        // Drive the (uncontrolled) item selects explicitly: the build prop
        // is present from the first render, but a restored draft arrives
        // after mount, so defaultValue alone can't show the items.
        Object.keys(itemNames).forEach((type) => {
            itemRefs[type].current.setValue({
                value: itemNames[type],
                label: removeMasterworkFromName(itemNames[type]),
            });
        });
        let charmString = buildParts.find((str) => str.includes('charm='));
        if (charmString) {
            // decodeURIComponent: decodeURI leaves %2C (comma) encoded since it's a reserved char
            let charmList = CharmShortener.parseCharmData(decodeURIComponent(charmString.split('charm=')[1]), itemData);

            // Cap the restored list to the 12-power charm limit.
            let cappedList = [];
            let powerCount = 0;
            charmList.forEach((name) => {
                if (powerCount + (itemData[name]?.power || 0) <= 12) {
                    powerCount += itemData[name]?.power || 0;
                    cappedList.push(name);
                }
            });

            setCharms(cappedList.map((name) => itemData[name]));
        }

        // class + skill points from the URL
        let classPart = buildParts.find((str) => str.includes('cl='));
        if (classPart) {
            const cls = classPart.split('cl=')[1];
            if (cls) {
                setGameClass(cls.toLowerCase());
            }
        }
        let skPart = buildParts.find((str) => str.includes('sk='));
        let loadedSkillPoints = {};
        if (skPart) {
            const nextPoints = {};
            decodeURIComponent(skPart.split('sk=')[1])
                .split(',')
                .forEach((part) => {
                    const [id, pts] = part.split(':');
                    const points = Number(pts);
                    if (id && Number.isInteger(points) && points > 0) nextPoints[id] = points;
                });
            loadedSkillPoints = nextPoints;
            setSkillPoints(nextPoints);
        }
        let spPart = buildParts.find((str) => str.includes('sp='));
        if (spPart) {
            const specName = decodeURIComponent(spPart.split('sp=')[1]);
            if (specName) {
                setSpec(specName);
            }
        }
        let sskPart = buildParts.find((str) => str.includes('ssk='));
        let loadedSpecPoints = {};
        if (sskPart) {
            const nextPoints = {};
            decodeURIComponent(sskPart.split('ssk=')[1])
                .split(',')
                .forEach((part) => {
                    const [id, pts] = part.split(':');
                    const points = Number(pts);
                    if (id && Number.isInteger(points) && points > 0) nextPoints[id] = points;
                });
            loadedSpecPoints = nextPoints;
            setSpecSkillPoints(nextPoints);
        }
        let enPart = buildParts.find((str) => str.includes('en='));
        let loadedEnhancements = {};
        if (enPart) {
            const nextEnhancements = {};
            decodeURIComponent(enPart.split('en=')[1])
                .split(',')
                .forEach((key) => {
                    if (key) nextEnhancements[key] = true;
                });
            loadedEnhancements = nextEnhancements;
            setEnhancements(nextEnhancements);
        }
        let czPart = buildParts.find((str) => str.includes('cz='));
        let nextCz = {};
        if (czPart) {
            const parsedCz = {};
            decodeURIComponent(czPart.split('cz=')[1])
                .split(',')
                .forEach((part) => {
                    // Legacy "Name:rarity" suffixes are dropped - abilities
                    // are always Twisted.
                    const name = part.split(':')[0];
                    if (name) parsedCz[name] = true;
                });
            nextCz = parsedCz;
            setCzAbilities(parsedCz);
            setCzOpen(true);
        }
        // Skills that were removed from the API: drop their points from the
        // form so the counters stay honest (the original URL is untouched
        // until the user edits and the link is rewritten).
        // Only filter when the skills data is already loaded: parentLoaded
        // fires before the /api/v2/skills fetch resolves, and filtering
        // against an empty skill set would wipe every loaded point. The
        // cleanup effect below re-filters once the data arrives.
        const loadedClass = classPart?.split('cl=')[1] || null;
        const loadedSpec = spPart ? decodeURIComponent(spPart.split('sp=')[1]) : null;
        const classData = skillsData?.classes?.find(
            (c) => (c.className || '').toLowerCase() == (loadedClass || '').toLowerCase()
        );
        if (skillsData && classData) {
            const knownSkillIds = new Set((classData.skills || []).map((s) => s.scoreboardId));
            const specData = loadedSpec ? classData.specs?.find((s) => s.specName == loadedSpec) : null;
            const knownSpecSkillIds = new Set((specData?.specSkills || []).map((s) => s.scoreboardId));
            loadedSkillPoints = Object.fromEntries(
                Object.entries(loadedSkillPoints).filter(([id]) => knownSkillIds.has(id))
            );
            loadedSpecPoints = Object.fromEntries(
                Object.entries(loadedSpecPoints).filter(([id]) => knownSpecSkillIds.has(id))
            );
            setSkillPoints(loadedSkillPoints);
            setSpecSkillPoints(loadedSpecPoints);
        }

        refreshClassBuffs(loadedSkillPoints, loadedSpecPoints, loadedEnhancements);
        // extra stat inputs (health/tenacity/vitality/vigor/focus/perspicacity/region)
        const statValues = {};
        for (const key of STAT_KEYS) {
            const part = buildParts.find((str) => str.startsWith(`${key}=`));
            if (part) statValues[key] = part.split('=')[1];
        }
        if (statValues.health !== undefined) {
            statValues.health = String(Math.max(0, Number(statValues.health)));
        }
        if (Object.keys(statValues).length > 0) {
            setStatInputs((prev) => ({ ...DEFAULT_STAT_INPUTS, ...statValues }));
            if (statValues.region !== undefined) {
                const regionNum = Number(statValues.region);
                if ([1, 2, 3].includes(regionNum)) {
                    setRegionValue(regionNum);
                    setRegionSelectKey((k) => k + 1);
                }
            }
        }

        // Saved builds carry the delve infusions + Revelation checkbox in
        // the DB (they are not part of the URL token); restore them here.
        // Drafts carry them inline the same way, and a draft that applies to
        // this page (same build + revision, see effectiveDraft) wins over the
        // DB copy so unsaved infusion edits are not dropped.
        const effSavedState = isLoadedBuild ? effDraft || savedState : effDraft;
        const loadedDelve = {};
        if (effSavedState && effSavedState.infusions && typeof effSavedState.infusions === 'object') {
            for (const [slot, infusion] of Object.entries(effSavedState.infusions)) {
                // Any infusion is valid in any region.
                const ok = DELVE_INFUSIONS.some((i) => i.name === infusion);
                if (ok) loadedDelve[slot] = infusion;
            }
            if (Object.keys(loadedDelve).length > 0) {
                setDelveInfusions(loadedDelve);
                // Restored infusions default to level IV (4 points) each.
                setDelvePoints(Object.fromEntries(Object.keys(loadedDelve).map((slot) => [slot, DELVE_POINT_DEFAULT])));
                setDelveOpen(true);
            }
        }
        const loadedRevelation = Boolean(effSavedState && effSavedState.revelation);
        if (loadedRevelation) setRevelation(true);

        // Basic (normal) infusions: per-slot picks are restored so their
        // dropdowns show them. Builds saved before the number boxes were tied
        // to the items, and token-only links (which carry just the per-type
        // totals), can have levels that no item carries: those are placed onto
        // the free items here, so nothing raises the stats unseen. Levels that
        // do not fit on any item are dropped.
        let loadedBasic = {};
        if (effSavedState && effSavedState.basicInfusions && typeof effSavedState.basicInfusions === 'object') {
            for (const [slot, value] of Object.entries(effSavedState.basicInfusions)) {
                if (!value || typeof value.name !== 'string') continue;
                if (!BASIC_INFUSIONS.some((i) => i.name === value.name)) continue;
                loadedBasic[slot] = {
                    name: value.name,
                    level: Math.max(1, Math.min(BASIC_INFUSION_MAX_LEVEL, Number(value.level) || 1)),
                };
            }
        }
        const storedGlobals =
            effSavedState && effSavedState.globalInfusions && typeof effSavedState.globalInfusions === 'object'
                ? effSavedState.globalInfusions
                : null;
        const wantedBasic = basicInfusionTotals(loadedBasic);
        for (const key of BASIC_INFUSION_STAT_KEYS) {
            // A saved state without the field predates the global boxes, so
            // its token totals were the per-slot sums (nothing extra to place).
            const source = storedGlobals ? storedGlobals[key] : effSavedState ? 0 : statValues[key];
            const value = Math.max(0, Math.min(BASIC_INFUSION_LEVEL_CAP, Math.floor(Number(source) || 0)));
            if (value > 0) wantedBasic[key] = value;
        }
        // Legacy total-only sources can have levels no item carried; the
        // resolver shares the items between every type (and drops what cannot
        // fit), so nothing raises the stats unseen.
        loadedBasic = resolveBasicInfusions(wantedBasic, itemNames, loadedBasic);
        // The build carries basic infusions: open the section, and apply them
        // even if the toggle happened to be off before the load.
        const hasBasicInfusions = Object.keys(loadedBasic).length > 0;
        if (hasBasicInfusions) {
            setBasicInfusions(loadedBasic);
            setBasicOpen(true);
        }
        const loadedTotals = basicInfusionTotals(loadedBasic);
        const loadedStatInputs = {};
        for (const key of BASIC_INFUSION_STAT_KEYS) loadedStatInputs[key] = loadedTotals[key] || 0;
        setStatInputs((prev) => ({ ...prev, ...loadedStatInputs }));

        // A build renamed on the "My Builds" page stores its display name in
        // the DB; surface it in the header so re-saving keeps the new name.
        if (effDraft && effDraft.name) {
            applyBuildName(effDraft.name);
        } else if (isLoadedBuild && savedName) {
            applyBuildName(savedName);
        }

        // Drafts also restore the notes text and remember the row they
        // belong to, so saves keep updating that same build.
        if (effDraft) {
            if (effDraft.notes != null) setNotesDraft(effDraft.notes);
            if (effDraft.buildId) setActiveBuildId(effDraft.buildId);
        }

        const delveEntries = {};
        for (const [slot, infusion] of Object.entries(loadedDelve)) {
            delveEntries[`delveInfusion-${slot}`] = infusion;
        }

        applyStatsUpdateNow(
            {
                ...itemNames,
                ...statValues,
                ...delveEntries,
                ...(Object.keys(delveEntries).length > 0 ? { delveEnabled: '1' } : {}),
                ...(hasBasicInfusions ? { infusionsEnabled: '1' } : {}),
                ...(loadedRevelation ? { revelation: '1' } : {}),
            },
            itemData,
            setStats,
            update
        );

        // Region gating: drop whatever the loaded region forbids (see regionChanged).
        const loadedRegion = Number(statValues.region) || 3;
        if (loadedRegion === 1) {
            setSpec(null);
            setSpecSkillPoints({});
            setEnhancements({});
            setCharms([]);
            setCzAbilities({});
            setCzOpen(false);
            refreshClassBuffs({}, {}, {});
        } else if (loadedRegion < 3) {
            setEnhancements({});
            setCharms([]);
            refreshClassBuffs(skillPoints, specSkillPoints, {});
        }
        if (loadedRegion === 2) {
            const prismaticOnly = Object.keys(nextCz).filter((name) =>
                czData?.trees?.some((t) => t.tree === 'Prismatic' && t.skills.some((s) => s.name === name))
            );
            if (prismaticOnly.length > 0) {
                const cleaned = { ...nextCz };
                prismaticOnly.forEach((name) => delete cleaned[name]);
                setCzAbilities(cleaned);
            }
        }
    }, [parentLoaded, effectiveDraft]);

    // A shared skill/infusion set opened from /builder?set=<id>: apply it
    // once, after the build/draft restore effect above has run. Skill sets
    // wait for the class data so buffs resolve.
    const sharedSetApplied = React.useRef(false);
    React.useEffect(() => {
        if (!sharedSet || sharedSetApplied.current || !parentLoaded) return;
        if (sharedSet.kind === 'skills' && !skillsData) return;
        sharedSetApplied.current = true;
        if (sharedSet.kind === 'delve') applyDelvePayload(sharedSet.payload);
        else applySkillPayload(sharedSet.payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sharedSet, parentLoaded, skillsData]);

    // Import the build list (items collected on the items page) into empty
    // slots; charms append within the 12-power budget. Equipped items are
    // removed from the list, leftovers (misc, consumables, extra same-slot
    // items) stay for the next import.
    React.useEffect(() => {
        if (!parentLoaded) return;
        if (!isBuildListEnabled()) return;
        const list = readBuildList();
        if (list.length === 0) return;

        // Baseline = what the token/draft load will (or already did) put in
        // the slots. Read it from the decoded token rather than the select
        // refs: the restore effect's setValue() is an async react-select
        // state update that hasn't flushed yet when this effect runs.
        const isLoadedBuild = Boolean(build);
        const effDraft = effectiveDraft;
        const loadToken = effDraft ? effDraft.token : build;
        const itemNames = {
            mainhand: 'None',
            offhand: 'None',
            helmet: 'None',
            chestplate: 'None',
            leggings: 'None',
            boots: 'None',
        };
        if (loadToken) {
            const decoded = decodeBuildParam(loadToken, itemData);
            if (decoded) {
                const buildParts = decodeURI(decoded).split('&');
                for (const type of Object.keys(itemNames)) {
                    const value = buildParts.find((str) => str.includes(`${type[0]}=`))?.split(`${type[0]}=`)[1];
                    if (value && itemData[value]) itemNames[type] = value;
                }
            }
        }
        const equipped = new Set();
        const charmsToAdd = [];
        let addedPower = 0;

        for (const entry of list) {
            const displayName = typeof entry === 'string' ? entry : entry.name;
            let key = resolveItemKey(itemData, displayName);
            if (!key) continue;
            // resolveItemKey returns the first matching variant key, which is
            // the lowest masterwork ("X-1"). With the "Max masterwork"
            // setting on, import at the highest variant instead - otherwise
            // the imported tile would start at masterwork 1 regardless.
            if (maxMasterworkDefault) {
                const variants = Object.keys(itemData).filter(
                    (k) => itemData[k].name === displayName && /-\d+$/.test(k)
                );
                if (variants.length > 1) {
                    const highest = Math.max(...variants.map((k) => Number(k.split('-').at(-1))));
                    key = variants.find((k) => Number(k.split('-').at(-1)) === highest) || key;
                }
            }
            const info = itemData[key];
            const type = String(info.type || '').toLowerCase();
            const slot = MAINHAND_TYPES.has(type)
                ? 'mainhand'
                : OFFHAND_TYPES.has(type)
                  ? 'offhand'
                  : EQUIP_SLOTS.includes(type)
                    ? type
                    : null;
            if (slot && itemNames[slot] === 'None') {
                itemNames[slot] = key;
                itemRefs[slot].current.setValue({ value: key, label: removeMasterworkFromName(key) });
                equipped.add(displayName);
            } else if (type === 'charm' && info.power && addedPower + info.power <= 12) {
                addedPower += info.power;
                charmsToAdd.push(info);
                equipped.add(displayName);
            }
        }

        if (equipped.size > 0) {
            if (charmsToAdd.length > 0) {
                setCharms((current) => {
                    let budget = 12 - current.reduce((sum, c) => sum + (c.power || 0), 0);
                    const next = [...current];
                    for (const charm of charmsToAdd) {
                        if (charm.power && charm.power <= budget) {
                            next.push(charm);
                            budget -= charm.power;
                        }
                    }
                    return next;
                });
            }
            applyStatsUpdate(itemNames, itemData, setStats, update);
            const leftovers = list.filter((entry) => {
                const name = typeof entry === 'string' ? entry : entry.name;
                return !equipped.has(name);
            });
            try {
                if (leftovers.length === 0) window.localStorage.removeItem(BUILD_LIST_KEY);
                else window.localStorage.setItem(BUILD_LIST_KEY, JSON.stringify(leftovers));
            } catch (e) {}
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parentLoaded, maxMasterworkDefault]);

    // Autosave the working state as a session draft (debounced) so an
    // accidental reload or a switch to another page doesn't lose it. Unsaved
    // work is restored on /builder; a saved build's draft only restores on
    // that build's own page (see effectiveDraft above), so opening the plain
    // builder always starts something new.
    const draftTimerRef = React.useRef(null);
    const writeDraftRef = React.useRef(null);

    function writeDraft() {
        try {
            // Skipped when the "Cache builds" setting is off.
            if (!isBuildsCacheEnabled()) return;
            window.localStorage.setItem(
                DRAFT_KEY,
                JSON.stringify({
                    token: makeBuildString(),
                    infusions: delveInfusions,
                    basicInfusions,
                    revelation,
                    name: buildNameRef.current !== 'Monumenta Builder' ? buildNameRef.current : null,
                    notes: notesDraft.trim() ? notesDraft : null,
                    buildId: activeBuildId || null,
                    revision: buildRevision,
                    savedAt: Date.now(),
                })
            );
        } catch (e) {}
    }

    // Shared debounce: state changes save through the effect below, while the
    // build name only lives in a ref (renaming must not re-render the form),
    // so committing a name asks for a save explicitly - otherwise reopening
    // the build restores the cached older name.
    function scheduleDraftSave(delay = 500) {
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => {
            draftTimerRef.current = null;
            const write = writeDraftRef.current;
            if (write) write();
        }, delay);
    }

    React.useEffect(() => {
        if (!parentLoaded) return;
        // Keep the debounced writer pointed at the latest state.
        writeDraftRef.current = writeDraft;
        scheduleDraftSave();
        return () => {
            if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        };
    }, [
        parentLoaded,
        stats,
        charms,
        gameClass,
        skillPoints,
        spec,
        specSkillPoints,
        enhancements,
        statInputs,
        regionValue,
        delveInfusions,
        basicInfusions,
        revelation,
        notesDraft,
        activeBuildId,
        buildRevision,
    ]);

    // Once the skills data is known (it loads async, after parentLoaded), drop
    // points for skills that no longer exist in the API. Only removes unknown
    // skills, so it never clobbers user edits or loaded points for known skills.
    React.useEffect(() => {
        if (!skillsData || !Array.isArray(skillsData.classes) || gameClass === 'none') return;
        const cls = skillsData.classes.find((c) => (c.className || '').toLowerCase() === gameClass);
        if (!cls) return;

        const knownSkillIds = new Set((cls.skills || []).map((s) => s.scoreboardId));
        const filteredSkills = Object.fromEntries(Object.entries(skillPoints).filter(([id]) => knownSkillIds.has(id)));
        let changed = Object.keys(filteredSkills).length !== Object.keys(skillPoints).length;

        let nextSpecPoints = specSkillPoints;
        const specData = spec ? cls.specs?.find((s) => s.specName === spec) : null;
        const knownSpecSkillIds = new Set((specData?.specSkills || []).map((s) => s.scoreboardId));
        const filteredSpecPoints = Object.fromEntries(
            Object.entries(specSkillPoints).filter(([id]) => knownSpecSkillIds.has(id))
        );
        if (Object.keys(filteredSpecPoints).length !== Object.keys(specSkillPoints).length) {
            nextSpecPoints = filteredSpecPoints;
            changed = true;
        }

        if (changed) {
            setSkillPoints(filteredSkills);
            setSpecSkillPoints(nextSpecPoints);
            refreshClassBuffs(filteredSkills, nextSpecPoints, enhancements);
        }
    }, [skillsData, gameClass, spec, skillPoints, specSkillPoints, enhancements]);

    const formRef = React.useRef();
    const itemRefs = {
        mainhand: React.useRef(),
        offhand: React.useRef(),
        helmet: React.useRef(),
        chestplate: React.useRef(),
        leggings: React.useRef(),
        boots: React.useRef(),
    };

    function resetForm(event) {
        for (let ref in itemRefs) {
            itemRefs[ref].current.setValue({ value: 'None', label: 'None' });
        }
        setGameClass('none');
        setSkillPoints({});
        setSpec(null);
        setSpecSkillPoints({});
        setEnhancements({});
        refreshClassBuffs({}, {}, {});
        setStatInputs(DEFAULT_STAT_INPUTS);
        setRegionValue(3);
        setRegionSelectKey((k) => k + 1);
        setCharms([]);
        setCharmSelectKey((k) => k + 1);
        setDelveInfusions({});
        setDelvePoints({});
        setBasicInfusions({});
        setRevelation(false);
        setCzAbilities({});
        setCzSelectedTree(CZ_MAIN_TREES[0]);
        applyBuildName('Monumenta Builder');
        setNotesDraft('');
        setActiveBuildId(null);
        for (let box in enabledBoxes) {
            enabledBoxes[box] = false;
        }
        for (let key in extraStats) {
            extraStats[key] = [];
        }
        setMultiplierListKey((k) => k + 1);
        applyStatsUpdate(emptyBuild, itemData, setStats, update);
    }

    function receiveMasterworkUpdate(newActiveItem, itemType) {
        let newBuild = {};
        for (let ref in itemRefs) {
            newBuild[ref] = itemRefs[ref].current.getValue()[0].value;
        }
        let mainhands = [
            'mainhand',
            'mainhand sword',
            'mainhand shield',
            'axe',
            'pickaxe',
            'wand',
            'scythe',
            'bow',
            'crossbow',
            'snowball',
            'trident',
            'alchemist bag',
        ];
        let offhands = ['offhand', 'offhand shield', 'offhand sword'];
        let actualItemType = mainhands.includes(itemType.toLowerCase())
            ? 'mainhand'
            : offhands.includes(itemType.toLowerCase())
              ? 'offhand'
              : itemType.toLowerCase();

        newBuild[actualItemType.toLowerCase()] = `${newActiveItem.name}-${newActiveItem.masterwork}`;
        itemRefs[actualItemType.toLowerCase()].current.setValue({
            value: `${newActiveItem.name}-${newActiveItem.masterwork}`,
            label: newActiveItem.name,
        });

        applyStatsUpdate(newBuild, itemData, setStats, update);
    }

    function getEquipName(type) {
        const decoded = decodedBuild;
        if (!decoded) return undefined;
        let buildParts = decodeURI(decoded).split('&');
        let allowedTypes = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];
        let name = allowedTypes.includes(type)
            ? buildParts.find((str) => str.includes(`${type[0]}=`))?.split(`${type[0]}=`)[1]
            : 'None';
        if (!Object.keys(itemData).includes(name)) {
            return { value: 'None', label: 'None' };
        }
        return { value: name, label: removeMasterworkFromName(name) };
    }

    function makeBuildString(charmsOverride, dataOverride, classOverride, skillsOverride, stateOverride) {
        const keysToShare = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];

        let entries;
        if (dataOverride) {
            if (typeof dataOverride[Symbol.iterator] === 'function') {
                entries = Array.from(dataOverride);
            } else {
                entries = Object.entries(dataOverride);
            }
        } else {
            entries = Array.from(new FormData(formRef.current).entries());
        }

        let legacy = '';
        for (const [key, value] of entries) {
            if (!keysToShare.includes(key)) continue;
            legacy += `${key[0]}=${encodeURIComponent(String(value))}&`;
        }
        for (const key of STAT_KEYS) {
            const entry = entries.find(([k]) => k === key);
            if (entry) legacy += `${key}=${encodeURIComponent(String(entry[1]))}&`;
        }

        const charmsToLookAt = charmsOverride ? charmsOverride : charms;
        if (!charmsToLookAt || charmsToLookAt.length === 0) {
            legacy += 'charm=None';
        } else {
            legacy += `charm=${encodeURIComponent(CharmShortener.shortenCharmList(charmsToLookAt))}`;
        }

        if (buildNameRef.current != 'Monumenta Builder') {
            legacy += `&name=${encodeURIComponent(buildNameRef.current)}`;
        }

        const classForUrl = classOverride ?? gameClass;
        if (classForUrl != 'none') {
            const cls = classForUrl.charAt(0).toUpperCase() + classForUrl.slice(1);
            legacy += `&cl=${encodeURIComponent(cls)}`;
        }

        const skillsForUrl = skillsOverride ?? Object.entries(skillPoints).filter(([, pts]) => pts > 0);
        if (skillsForUrl.length > 0) {
            legacy += `&sk=${skillsForUrl.map(([id, pts]) => `${id}:${pts}`).join(',')}`;
        }

        if (gameClass != 'none') {
            const specForUrl = stateOverride?.spec !== undefined ? stateOverride.spec : spec;
            if (specForUrl) {
                legacy += `&sp=${encodeURIComponent(specForUrl)}`;
            }
            const specSkillsForUrl = stateOverride?.specSkills
                ? Object.entries(stateOverride.specSkills).filter(([, pts]) => pts > 0)
                : Object.entries(specSkillPoints).filter(([, pts]) => pts > 0);
            if (specSkillsForUrl.length > 0) {
                legacy += `&ssk=${specSkillsForUrl.map(([id, pts]) => `${id}:${pts}`).join(',')}`;
            }
        }

        const enForUrl = stateOverride?.enhancements
            ? Object.keys(stateOverride.enhancements)
            : Object.keys(enhancements);
        if (enForUrl.length > 0) {
            legacy += `&en=${enForUrl.join(',')}`;
        }

        const czForUrl = stateOverride?.czAbilities
            ? Object.entries(stateOverride.czAbilities)
            : Object.entries(czAbilities);
        if (czForUrl.length > 0) {
            legacy += `&cz=${encodeURIComponent(czForUrl.map(([name]) => name).join(','))}`;
        }

        return encodeBuildParam(legacy);
    }

    function checkboxChanged(event) {
        // Checkbox names come in lowercase, with words separated by spaces.
        // Replace every space so multi-word situationals (e.g. "curse of the
        // veil") map to their snake_case enabledBoxes key.
        const name = event.target.name.replace(/ /g, '_').replace(/[()]/g, '');
        enabledBoxes[name] = event.target.checked;
        let temp = event.target.checked;
        const retaliationtypes = ['retaliation_normal', 'retaliation_elite', 'retaliation_boss'];
        if (retaliationtypes.includes(name)) {
            retaliationtypes.forEach((type) => {
                enabledBoxes[type] = false;
                setCheckboxChecked(event.target.form, type.split('_')[0] + ' (' + type.split('_')[1] + ')', false);
            });
            enabledBoxes[name] = temp;
            event.target.checked = temp;
        }
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function getCheckboxRef(form, name) {
        return form[Object.keys(form).find((key) => form[key].type == 'checkbox' && form[key].name == name)];
    }

    function setCheckboxChecked(form, name, checked) {
        getCheckboxRef(form, name).checked = checked;
    }

    function multipliersChanged(newMultipliers, name) {
        extraStats[name] = newMultipliers;
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function damageMultipliersChanged(newMultipliers) {
        multipliersChanged(newMultipliers, 'damageMultipliers');
    }

    function resistanceMultipliersChanged(newMultipliers) {
        multipliersChanged(newMultipliers, 'resistanceMultipliers');
    }

    function healthMultipliersChanged(newMultipliers) {
        multipliersChanged(newMultipliers, 'healthMultipliers');
    }

    function speedMultipliersChanged(newMultipliers) {
        multipliersChanged(newMultipliers, 'speedMultipliers');
    }
    function attackSpeedMultipliersChanged(newMultipliers) {
        multipliersChanged(newMultipliers, 'attackSpeedMultipliers');
    }

    function updateCharms(charmNames) {
        // Dedupe by resolved key so a charm can never appear twice (the
        // selector add-entry guard also blocks it; this covers loaded lists).
        const seen = new Set();
        let charmData = charmNames
            .map((name) => {
                const key = resolveCharmKey(itemData, name);
                if (!key || seen.has(key)) return null;
                seen.add(key);
                return itemData[key];
            })
            .filter(Boolean);
        setCharms(charmData);
    }

    // Drag-to-reorder the equipped charms. Charm order lives in the build
    // token (the charm= list), so reordering here is reflected everywhere
    // the build is rendered: the saved link, the OG embed and the public
    // database cards.
    const charmDragRef = React.useRef(null);
    const [charmDragging, setCharmDragging] = React.useState(null);

    function startCharmDrag(name, e) {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', `charm:${name}`);
            e.dataTransfer.effectAllowed = 'move';
            const row = e.currentTarget.closest(`.${styles.charmCardWrap}`) || e.currentTarget;
            if (row) {
                const ghost = row.cloneNode(true);
                ghost.style.position = 'fixed';
                ghost.style.left = '-9999px';
                ghost.style.top = '-9999px';
                ghost.style.pointerEvents = 'none';
                ghost.style.opacity = '0.85';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 30, 30);
                requestAnimationFrame(() => ghost.remove());
            }
        }
        charmDragRef.current = name;
        setCharmDragging(name);
    }

    function endCharmDrag() {
        charmDragRef.current = null;
        setCharmDragging(null);
    }

    function charmDragOver(name, e) {
        const dragged = charmDragRef.current;
        if (!dragged || dragged === name) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const names = charms.map((c) => c.name);
        const from = names.indexOf(dragged);
        const to = names.indexOf(name);
        if (from === -1 || to === -1) return;
        const next = [...names];
        next.splice(from, 1);
        next.splice(to, 0, dragged);
        updateCharms(next);
    }

    function removeCharm(charm) {
        updateCharms(charms.filter((c) => c.name !== charm.name).map((c) => c.name));
    }

    // Drag-to-reorder the stat category cards, same drag-and-drop system as
    // the equipped charms. Stat cards carry a CSS `order` (grid/flex order
    // property), so dragging swaps entries in statCardOrder and the layout
    // follows. The order is a per-session preference (it resets on load).
    const STAT_CARD_KEYS = ['misc', 'health', 'dr', 'drhn', 'ehp', 'melee', 'projectile', 'magic'];
    const [statCardOrder, setStatCardOrder] = React.useState([...STAT_CARD_KEYS]);
    const statCardDragRef = React.useRef(null);

    function startStatCardDrag(key, e) {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', `statCard:${key}`);
            e.dataTransfer.effectAllowed = 'move';
            const card = e.currentTarget;
            if (card) {
                const ghost = card.cloneNode(true);
                ghost.style.position = 'fixed';
                ghost.style.left = '-9999px';
                ghost.style.top = '-9999px';
                ghost.style.pointerEvents = 'none';
                ghost.style.opacity = '0.85';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 30, 30);
                requestAnimationFrame(() => ghost.remove());
            }
        }
        statCardDragRef.current = key;
    }

    function endStatCardDrag() {
        statCardDragRef.current = null;
    }

    function statCardDragOver(key, e) {
        const dragged = statCardDragRef.current;
        if (!dragged || dragged === key) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const from = statCardOrder.indexOf(dragged);
        const to = statCardOrder.indexOf(key);
        if (from === -1 || to === -1) return;
        const next = [...statCardOrder];
        next.splice(from, 1);
        next.splice(to, 0, dragged);
        setStatCardOrder(next);
    }

    function statCardOrderStyle(key) {
        return { order: statCardOrder.indexOf(key) };
    }

    function itemChanged(newValue, actionMeta) {
        // This is here so you don't have to scroll down to "Recalculate" and then back up to click a situational.
        // It updates the whole form. I don't think this was the original intent but checkboxes do anyway
        // so may as well. However, it's kind of awkward because the FormData.entries() does not yet contain
        // the new value of the item that was just changed, so we have to get it ourselves.
        // Unlike most event handler props, Select's `onChange` does not pass an event.
        // It instead passes the new value of the Select, and an "action meta" containing the checkbox name (and other stuff).
        // Why is this not condensed into an event containing both of these and a ref to the target? Beats me. -LC
        let entries = Array.from(new FormData(formRef.current).entries());
        for (let i = 0; i < entries.length; i++) {
            if (entries[i][0] == actionMeta.name) entries[i][1] = newValue.value;
        }
        const itemNames = Object.fromEntries(entries);
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    function classChanged(newValue, actionMeta) {
        // no need to check actionmeta because theres only one class dropdown
        let newClass = newValue.value.toLowerCase();
        setGameClass(newClass);
        setSkillPoints({});
        setSpec(null);
        setSpecSkillPoints({});
        setEnhancements({});
        refreshClassBuffs({}, {}, {});
        const itemNames = Object.fromEntries(new FormData(formRef.current).entries());
        applyStatsUpdate(itemNames, itemData, setStats, update);
    }

    const miscStats = [
        { type: 'armor', name: 'builder.stats.misc.armor', percent: false },
        { type: 'agility', name: 'builder.stats.misc.agility', percent: false },
        { type: 'speedPercent', name: 'builder.stats.misc.speed', percent: true },
        { type: 'knockbackRes', name: 'builder.stats.misc.kbResistance', percent: true },
        { type: 'thorns', name: 'builder.stats.misc.thorns', percent: false },
        { type: 'fireTickDamage', name: 'builder.stats.misc.fireTickDamage', percent: false },
        { type: 'spellCooldownPercent', name: 'builder.stats.magic.spellCooldownPercent', percent: true },
    ];
    const healthStats = [
        { type: 'healthFinal', name: 'builder.stats.health.healthFinal', percent: false },
        { type: 'currentHealth', name: 'builder.stats.health.currentHealth', percent: false },
        { type: 'healingRate', name: 'builder.stats.health.healingRate', percent: true },
        { type: 'effHealingRate', name: 'builder.stats.health.effectiveHealingRate', percent: true },
        { type: 'regenPerSec', name: 'builder.stats.health.regenPerSecond', percent: false },
        { type: 'regenPerSecPercent', name: 'builder.stats.health.regenPerSecondPercent', percent: true },
        { type: 'lifeDrainOnCrit', name: 'builder.stats.health.lifeDrainOnCrit', percent: false },
        { type: 'lifeDrainOnCritPercent', name: 'builder.stats.health.lifeDrainOnCritPercent', percent: true },
    ];
    const DRStats = [
        { type: 'meleeDR', name: 'builder.stats.dr-ehp.melee', percent: true },
        { type: 'projectileDR', name: 'builder.stats.dr-ehp.projectile', percent: true },
        { type: 'magicDR', name: 'builder.stats.dr-ehp.magic', percent: true },
        { type: 'blastDR', name: 'builder.stats.dr-ehp.blast', percent: true },
        { type: 'fireDR', name: 'builder.stats.dr-ehp.fire', percent: true },
        { type: 'fallDR', name: 'builder.stats.dr-ehp.fall', percent: true },
        { type: 'ailmentDR', name: 'builder.stats.dr-ehp.ailment', percent: true },
    ];
    const healthNormalizedDRStats = [
        { type: 'meleeHNDR', name: 'builder.stats.dr-ehp.melee', percent: true },
        { type: 'projectileHNDR', name: 'builder.stats.dr-ehp.projectile', percent: true },
        { type: 'magicHNDR', name: 'builder.stats.dr-ehp.magic', percent: true },
        { type: 'blastHNDR', name: 'builder.stats.dr-ehp.blast', percent: true },
        { type: 'fireHNDR', name: 'builder.stats.dr-ehp.fire', percent: true },
        { type: 'fallHNDR', name: 'builder.stats.dr-ehp.fall', percent: true },
        { type: 'ailmentHNDR', name: 'builder.stats.dr-ehp.ailment', percent: true },
    ];
    const EHPStats = [
        { type: 'meleeEHP', name: 'builder.stats.dr-ehp.melee', percent: false },
        { type: 'projectileEHP', name: 'builder.stats.dr-ehp.projectile', percent: false },
        { type: 'magicEHP', name: 'builder.stats.dr-ehp.magic', percent: false },
        { type: 'blastEHP', name: 'builder.stats.dr-ehp.blast', percent: false },
        { type: 'fireEHP', name: 'builder.stats.dr-ehp.fire', percent: false },
        { type: 'fallEHP', name: 'builder.stats.dr-ehp.fall', percent: false },
        { type: 'ailmentEHP', name: 'builder.stats.dr-ehp.ailment', percent: false },
    ];
    const meleeStats = [
        { type: 'attackSpeedPercent', name: 'builder.stats.melee.attackSpeedPercent', percent: true },
        { type: 'attackSpeed', name: 'builder.stats.melee.attackSpeed', percent: false },
        { type: 'attackDamagePercent', name: 'builder.stats.melee.attackDamagePercent', percent: true },
        { type: 'classAttackDamagePercent', name: 'builder.stats.melee.classAttackDamagePercent', percent: true },
        { type: 'attackDamage', name: 'builder.stats.melee.attackDamage', percent: false },
        { type: 'attackDamageCrit', name: 'builder.stats.melee.attackDamageCrit', percent: false },
        { type: 'iframeDPS', name: 'builder.stats.melee.iframeDps', percent: false },
        { type: 'iframeCritDPS', name: 'builder.stats.melee.iframeCritDps', percent: false },
        { type: 'critSpamDPS', name: 'builder.stats.melee.critSpamDPS', percent: false },
    ];
    const projectileStats = [
        { type: 'projectileDamagePercent', name: 'builder.stats.projectile.projectileDamagePercent', percent: true },
        {
            type: 'classProjectileDamagePercent',
            name: 'builder.stats.projectile.classProjectileDamagePercent',
            percent: true,
        },
        { type: 'projectileDamage', name: 'builder.stats.projectile.projectileDamage', percent: false },
        { type: 'projectileSpeedPercent', name: 'builder.stats.projectile.projectileSpeedPercent', percent: true },
        { type: 'projectileSpeed', name: 'builder.stats.projectile.projectileSpeed', percent: false },
        { type: 'throwRatePercent', name: 'builder.stats.projectile.throwRatePercent', percent: true },
        { type: 'throwRate', name: 'builder.stats.projectile.throwRate', percent: false },
    ];
    const magicStats = [
        { type: 'magicDamagePercent', name: 'builder.stats.magic.magicDamagePercent', percent: true },
        { type: 'classMagicDamagePercent', name: 'builder.stats.magic.classMagicDamagePercent', percent: true },
        // { type: "spellPowerPercent", name: "builder.stats.magic.spellPowerPercent", percent: true },
        // technically for consistency having this ^ line here doesn't make sense because it's like if
        // melee stats listed "weapon base attack damage" as a line
        // but i might re add it anyway if people don't like it being removed

        // one of these two gets hidden later depending on if potion damage exists
        // spell is only for wands, potion is only for alch bags
        { type: 'spellDamage', name: 'builder.stats.magic.spellDamage', percent: true },
        { type: 'potionDamage', name: 'builder.stats.magic.potionDamage', percent: false },
    ];

    const czAllSkills = czData ? czData.trees.flatMap((t) => t.skills) : [];
    const czAbilityMap = new Map(czAllSkills.map((s) => [s.name, s]));
    const czActiveCount = Object.keys(czAbilities).filter(
        (name) => czAbilityMap.get(name)?.trigger && czAbilityMap.get(name).trigger !== 'Passive'
    ).length;
    const czTrees = czData
        ? czData.trees
              .filter((t) => CZ_MAIN_TREES.includes(t.tree))
              .filter((t) => regionValue !== 2 || t.tree !== 'Prismatic')
        : [];
    const czActiveTree = czTrees.find((t) => t.tree === czSelectedTree) || czTrees[0] || null;

    // Reorderable lists (drag-to-arrange), with the user's custom order from
    // localStorage applied per class / specialization / tree.
    const classOrderContainer = gameClass != 'none' ? `class.${gameClass}` : null;
    const classSkillList = classOrderContainer
        ? applyStoredOrder(currentClassSkills, (s) => s.scoreboardId, classOrderContainer)
        : currentClassSkills;
    const specOrderContainer = gameClass != 'none' && spec ? `spec.${gameClass}.${spec}` : null;
    const specSkillList = specOrderContainer
        ? applyStoredOrder(currentSpecSkills, (s) => s.scoreboardId, specOrderContainer)
        : currentSpecSkills;
    const czOrderContainer = czActiveTree ? `cz.${regionValue}.${czActiveTree.tree}` : null;
    const czSkillList = czOrderContainer
        ? applyStoredOrder(czActiveTree.skills, (a) => a.name, czOrderContainer)
        : czActiveTree
          ? czActiveTree.skills
          : [];

    // Totals of every stat across all equipped charms (effect summary).
    const equippedCharmNames = charms.map((c) => c.name);
    const charmTotals = React.useMemo(
        () => computeCharmTotals(itemData, equippedCharmNames),
        [itemData, equippedCharmNames]
    );
    const charmStatColors = React.useMemo(
        () => computeCharmStatColors(itemData, equippedCharmNames),
        [itemData, equippedCharmNames]
    );

    const { newLayout } = useBuilderLayout();
    const isDesktop = useIsDesktop();
    const splitLayout = newLayout && isDesktop;

    // The six equipment slot inputs. In the New Layout they render as a left
    // column in rows of two (mainhand/offhand, helmet/chestplate, leggings/
    // boots); otherwise they sit in the normal flow above the item tiles.
    // The cells use the module class instead of bootstrap cols in the split
    // layout - bootstrap's col-* grid rules break the 2-column grid.
    const decodedBuild = React.useMemo(() => decodeBuildParam(build, itemData), [build, itemData]);
    const slotOptions = React.useMemo(
        () => ({
            mainhand: getRelevantItems(
                [
                    'mainhand',
                    'mainhand sword',
                    'mainhand shield',
                    'axe',
                    'pickaxe',
                    'wand',
                    'scythe',
                    'bow',
                    'crossbow',
                    'snowball',
                    'trident',
                    'alchemist bag',
                ],
                itemData,
                favouriteSet
            ),
            offhand: getRelevantItems(['offhand', 'offhand shield', 'offhand sword'], itemData, favouriteSet),
            helmet: getRelevantItems(['helmet'], itemData, favouriteSet),
            chestplate: getRelevantItems(['chestplate'], itemData, favouriteSet),
            leggings: getRelevantItems(['leggings'], itemData, favouriteSet),
            boots: getRelevantItems(['boots'], itemData, favouriteSet),
        }),
        [itemData, favouriteSet]
    );

    const slotCellClass = splitLayout ? `${styles.slotCell} text-center` : 'col-6 col-md-3 col-lg-2 text-center';
    const slotsSection = (
        <div className={`${styles.equipSlots} row justify-content-center mb-1`}>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.mainhand"></TranslatableText>
                <SelectInput
                    reference={itemRefs.mainhand}
                    name="mainhand"
                    default={getEquipName('mainhand')}
                    noneOption={true}
                    sortableStats={slotOptions.mainhand}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('mainhand')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('mainhand')}
                {splitLayout && renderEquippedTile('mainhand')}
            </div>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.offhand"></TranslatableText>
                <SelectInput
                    reference={itemRefs.offhand}
                    name="offhand"
                    default={getEquipName('offhand')}
                    noneOption={true}
                    sortableStats={slotOptions.offhand}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('offhand')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('offhand')}
                {splitLayout && renderEquippedTile('offhand')}
            </div>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.helmet"></TranslatableText>
                <SelectInput
                    reference={itemRefs.helmet}
                    noneOption={true}
                    name="helmet"
                    default={getEquipName('helmet')}
                    sortableStats={slotOptions.helmet}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('helmet')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('helmet')}
                {splitLayout && renderEquippedTile('helmet')}
            </div>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.chestplate"></TranslatableText>
                <SelectInput
                    reference={itemRefs.chestplate}
                    noneOption={true}
                    name="chestplate"
                    default={getEquipName('chestplate')}
                    sortableStats={slotOptions.chestplate}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('chestplate')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('chestplate')}
                {splitLayout && renderEquippedTile('chestplate')}
            </div>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.leggings"></TranslatableText>
                <SelectInput
                    reference={itemRefs.leggings}
                    noneOption={true}
                    name="leggings"
                    default={getEquipName('leggings')}
                    sortableStats={slotOptions.leggings}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('leggings')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('leggings')}
                {splitLayout && renderEquippedTile('leggings')}
            </div>
            <div className={slotCellClass}>
                <TranslatableText identifier="items.type.boots"></TranslatableText>
                <SelectInput
                    reference={itemRefs.boots}
                    noneOption={true}
                    name="boots"
                    default={getEquipName('boots')}
                    sortableStats={slotOptions.boots}
                    onChange={itemChanged}
                ></SelectInput>
                {delveOpen && delveSlotSelects('boots')}
                {basicOpen && infusionInputMode !== 'total' && basicSlotSelects('boots')}
                {splitLayout && renderEquippedTile('boots')}
            </div>
        </div>
    );

    // Equipped item tiles: show up right below the slot inputs (in the New
    // Layout they sit under the slots in the left column).
    // The equipped item tile for one slot (or null when nothing is equipped
    // there). In the New Layout each tile renders inside its own slot cell,
    // directly below that slot's dropdown.
    function renderEquippedTile(type) {
        if (!checkExists(type, stats, itemData)) return null;
        const tileName = stats.itemNames[type];
        return (
            <div className={`col-auto ${styles.builderCol}`} key={`${tileName}-${type}`}>
                {stats.fullItemData[type].masterwork != undefined ? (
                    <MasterworkableItemTile
                        update={receiveMasterworkUpdate}
                        name={removeMasterworkFromName(tileName)}
                        item={createMasterworkData(removeMasterworkFromName(tileName), itemData)}
                        itemData={itemData}
                        default={Number(tileName.split('-').at(-1))}
                        showFavouriteButton
                    ></MasterworkableItemTile>
                ) : (
                    <ItemTile name={tileName} item={stats.fullItemData[type]} showFavouriteButton></ItemTile>
                )}
            </div>
        );
    }

    const itemTiles = <div className="row justify-content-center mb-1">{itemTypes.map(renderEquippedTile)}</div>;

    // Charm picker + equipped charm tiles (between the item tiles and stats).
    const charmsSection = (
        <>
            <div className="row mb-1">
                <div className="col-12">
                    <CharmSelector
                        key={charmSelectKey}
                        update={updateCharms}
                        translatableName={'builder.charms.select'}
                        itemData={itemData}
                        hideList
                        charmNames={charmNameList}
                        classSkillNames={classSkillNameList}
                        specSkillNames={specSkillNameList}
                        selectedClass={gameClass}
                    ></CharmSelector>
                </div>
            </div>
            <div className="row justify-content-center mb-1">
                {charms.map((charm) => (
                    <div className={`col-auto ${styles.builderCol}`} key={charm.name}>
                        <div
                            className={`${styles.charmCardWrap}${charmDragging === charm.name ? ` ${styles.charmDragging}` : ''}`}
                            draggable
                            onDragStart={(e) => startCharmDrag(charm.name, e)}
                            onDragOver={(e) => charmDragOver(charm.name, e)}
                            onDragEnd={endCharmDrag}
                        >
                            <CharmTile name={charm.name} item={charm} showFavouriteButton></CharmTile>
                            <button
                                type="button"
                                className={styles.charmRemoveButton}
                                onClick={() => removeCharm(charm)}
                                aria-label={`${t('common.remove')} ${charm.name}`}
                                title={t('builder.charms.removeCharm')}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    // Collapsible charm stat summary (stays with the charm section).
    const charmStatsSection = (
        <>
            <div className="row justify-content-center mb-1">
                <div className={`${styles.charmTotals}`}>
                    <button
                        type="button"
                        className={styles.charmTotalsHeader}
                        aria-expanded={charmStatsOpen}
                        onClick={() => setCharmStatsOpen((o) => !o)}
                    >
                        <span className={styles.charmTotalsTitle}>{t('builder.charms.statsTitle')}</span>
                        <span className={styles.charmTotalsChevron}>❯</span>
                    </button>
                    {charmStatsOpen && (
                        <>
                            {Object.entries(charmTotals).map(([stat, obj]) => {
                                const parts = CharmFormatter.charmStatParts(stat, obj);
                                const color = CharmFormatter.statColor(stat, charmStatColors);
                                return (
                                    <p key={stat} className={`${styles.statRow} mb-0 mt-1`}>
                                        <b>{parts.label}</b>
                                        <span
                                            className={`${styles.monoValue} ${styles[CharmFormatter.statStyle(stat, obj)]}`}
                                            style={color ? { color } : undefined}
                                        >
                                            {parts.value}
                                        </span>
                                    </p>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </>
    );

    // The sections that follow the stats in the default flow: situational
    // stat toggles, the health slider and the notes. In the New Layout they
    // render centered below the two columns, together with the charms.
    // Per-type totals for the number boxes (always the items' sums).
    const infusionTotals = basicInfusionTotals();

    const tailSections = (
        <>
            <div className="row justify-content-center pt-1 mb-1 g-1">
                <TranslatableText
                    identifier="builder.misc.situationals"
                    className="text-center mb-1"
                ></TranslatableText>
                {generateSituationalCheckboxes(itemsToDisplay, checkboxChanged, delveOpen ? delveInfusions : null, {
                    frenzyLevel: gameClass === 'warrior' ? skillPoints.Frenzy || 0 : 0,
                    frenzyEnhanced: gameClass === 'warrior' && Boolean(enhancements.Frenzy),
                })}
            </div>
            <div className="d-flex justify-content-center flex-wrap align-items-start mb-1">
                <HealthControls
                    value={statInputs.health}
                    onSchedule={scheduleStatsRecalc}
                    onCommit={commitHealthInput}
                    currentHealth={itemsToDisplay.currentHealth}
                    healthFinal={itemsToDisplay.healthFinal}
                />
                {/* Normal infusion number boxes: one per infusion type, each
                    showing the levels the items carry. Editing one re-shares
                    the items across every type that has levels (see
                    changeSyncedInfusion), so a total the items cannot hold
                    settles lower instead of raising the stats. Hidden while
                    the Infusions toggle is off, like the picks themselves, and
                    when Settings -> Infusion inputs is set to per-item. */}
                {basicOpen && infusionInputMode !== 'item' && (
                    <div className="d-flex flex-wrap justify-content-center align-items-start">
                        {BASIC_INFUSION_BOX_KEYS.map((key) => (
                            <div className="text-center mx-2" key={key}>
                                <p className="mb-1" style={{ textTransform: 'capitalize' }}>
                                    {key}
                                </p>
                                <input
                                    type="number"
                                    min="0"
                                    max={BASIC_INFUSION_LEVEL_CAP}
                                    value={infusionTotals[key] || 0}
                                    onChange={(event) => changeSyncedInfusion(key, event.target.value)}
                                    className={styles.infusionLevelInput}
                                    aria-label={`${key} infusion level`}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {/* Basic infusion totals (per-slot + global levels) live in
                    hidden inputs so the stat calculation (Stats reads
                    formData.tenacity/vitality/vigor/focus/perspicacity) and
                    the saved build token keep working without visible inputs.
                    The enabled flags let the toggles above turn the effects
                    off without dropping the picks. */}
                <input type="hidden" name="delveEnabled" value={delveOpen ? '1' : '0'} />
                <input type="hidden" name="infusionsEnabled" value={basicOpen ? '1' : '0'} />
                <input type="hidden" name="tenacity" value={statInputs.tenacity} />
                <input type="hidden" name="vitality" value={statInputs.vitality} />
                <input type="hidden" name="vigor" value={statInputs.vigor} />
                <input type="hidden" name="focus" value={statInputs.focus} />
                <input type="hidden" name="perspicacity" value={statInputs.perspicacity} />
                {/* How many items carry each basic infusion type; the Stats
                    engine uses it for Understanding's per-item amplifier. */}
                <input
                    type="hidden"
                    name="basicInfusionCounts"
                    value={JSON.stringify(basicInfusionCounts(basicInfusions))}
                />
            </div>
            <div className="row pt-1">
                <span className="text-center text-danger fs-2 fw-bold">
                    {stats.corruption > 1 ? (
                        <TranslatableText identifier="builder.errors.corruption"></TranslatableText>
                    ) : (
                        ''
                    )}
                </span>
            </div>
            <div className="row py-1">
                <span className="text-center text-danger fs-2 fw-bold">
                    {stats.twoHanded && !stats.weightless && stats.itemNames.offhand != 'None' ? (
                        <TranslatableText identifier="builder.errors.twoHanded"></TranslatableText>
                    ) : (
                        ''
                    )}
                </span>
            </div>
            <div className="row mb-1 justify-content-center">
                <div className="col-auto">
                    <label className={`${styles.delveToggle} ${multipliersOpen ? styles.delveToggleActive : ''}`}>
                        <input
                            type="checkbox"
                            checked={multipliersOpen}
                            onChange={(e) => setMultipliersOpen(e.target.checked)}
                            aria-label={t('builder.misc.extraMultipliers')}
                        />
                        {t('builder.misc.multipliers')}
                    </label>
                </div>
            </div>
            <div className="row mb-1 justify-content-center" style={multipliersOpen ? undefined : { display: 'none' }}>
                <div className="col-12 col-md-6 col-lg-2">
                    <ListSelector
                        key={`damage-${multiplierListKey}`}
                        update={damageMultipliersChanged}
                        translatableName="builder.multipliers.damage"
                        description={t('builder.multipliers.damage.description')}
                    ></ListSelector>
                </div>
                <div className="col-12 col-md-6 col-lg-2">
                    <ListSelector
                        key={`resistance-${multiplierListKey}`}
                        update={resistanceMultipliersChanged}
                        translatableName="builder.multipliers.resistance"
                        description={t('builder.multipliers.resistance.description')}
                    ></ListSelector>
                </div>
                <div className="col-12 col-md-6 col-lg-2">
                    <ListSelector
                        key={`health-${multiplierListKey}`}
                        update={healthMultipliersChanged}
                        translatableName="builder.multipliers.health"
                        description={t('builder.multipliers.health.description')}
                    ></ListSelector>
                </div>
                <div className="col-12 col-md-6 col-lg-2">
                    <ListSelector
                        key={`speed-${multiplierListKey}`}
                        update={speedMultipliersChanged}
                        translatableName="builder.multipliers.speed"
                        description={t('builder.multipliers.speed.description')}
                    ></ListSelector>
                </div>
                <div className="col-12 col-md-6 col-lg-2">
                    <ListSelector
                        key={`attackSpeed-${multiplierListKey}`}
                        update={attackSpeedMultipliersChanged}
                        translatableName="builder.multipliers.attackSpeed"
                        description={t('builder.multipliers.attackSpeed.description')}
                    ></ListSelector>
                </div>
            </div>

            {/* Notes: a signed-in feature. Owner edits on their short link,
                        logged-in users can jot them on the builder (saved together
                        with the build), everyone sees them on shared links. */}
            {(canEditNotes === true ||
                (canEditNotes === undefined && loggedIn === true) ||
                (canEditNotes === false && notes)) && (
                <div className="row justify-content-center mt-3">
                    <div className="col-12 col-lg-8 col-xl-6">
                        {canEditNotes === false ? (
                            <div className={styles.buildNotesBody}>{notes}</div>
                        ) : (
                            <>
                                <textarea
                                    className={styles.buildNotesInput}
                                    value={notesDraft}
                                    onChange={(e) => {
                                        const { cleaned, found } = filterBadWords(e.target.value);
                                        if (found) triggerRedX();
                                        setNotesDraft(cleaned);
                                    }}
                                    placeholder={t('builder.notes.placeholder')}
                                    rows={3}
                                    maxLength={500}
                                />
                                <div className={styles.buildNotesActions}>
                                    {canEditNotes ? (
                                        <>
                                            <button
                                                type="button"
                                                className={styles.shareButton}
                                                onClick={saveNotes}
                                                disabled={notesSaveState === 'saving'}
                                            >
                                                {notesSaveState === 'saving'
                                                    ? t('builder.notes.saving')
                                                    : notesSaveState === 'saved'
                                                      ? t('builder.notes.saved')
                                                      : t('builder.notes.saveNotes')}
                                            </button>
                                            {notesSaveState === 'saved' && (
                                                <span className={styles.buildNotesSaved}>
                                                    {t('builder.notes.savedMessage')}
                                                </span>
                                            )}
                                            {notesSaveState === 'error' && (
                                                <span className={styles.importError}>
                                                    {t('builder.notes.saveError')}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className={styles.buildNotesHint}>{t('builder.notes.hint')}</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {tip &&
                createPortal(
                    <div className={styles.infusionTip} style={{ left: tip.left, top: tip.top }}>
                        <span style={{ fontWeight: 600 }}>{tip.info.name}</span>
                        {tip.info.effect && <span style={{ display: 'block', marginTop: 3 }}>{tip.info.effect}</span>}
                    </div>,
                    document.body
                )}
        </>
    );

    // Copy/save only makes sense once something is actually built (a build
    // with no gear and no charms would just create an empty share link).
    const buildContentReady = formHasEquippedItem(formRef.current) || charms.length > 0;

    // Summary shown on the collapsed region/class dropdown on phones.
    const selectedRegionLabel =
        czOpen && regionValue === 2
            ? t('builder.regions.darkestDepths')
            : czOpen && regionValue === 3
              ? t('builder.regions.celestialZenith')
              : (regions.find((region) => region.value === regionValue) || {}).label || '';
    const selectedClassLabel =
        gameClass && gameClass !== 'none' ? gameClass.charAt(0).toUpperCase() + gameClass.slice(1) : '';
    const regionClassSummary = [selectedRegionLabel, selectedClassLabel, spec].filter(Boolean).join(' · ');

    return (
        <form ref={formRef} onSubmit={sendUpdate} onReset={resetForm} id="buildForm">
            {showRedX && <img src="/images/redx.png" className={styles.redXOverlay} alt="" />}
            {/* Top row: region/class/spec + infusion toggles | title |
                import/skill sets. On phones the two control clusters fold
                into dropdowns (see the builder group styles) so the row fits
                without wrapping. */}
            <div className={`${styles.builderTopRow} mb-1`}>
                <div className={`d-flex flex-wrap align-items-center ${styles.builderControls}`}>
                    <div className={`${styles.builderGroup}${regionClassOpen ? ' ' + styles.builderGroupOpen : ''}`}>
                        <button
                            type="button"
                            className={styles.builderGroupToggle}
                            aria-expanded={regionClassOpen}
                            aria-controls="builder-region-class"
                            onClick={() => setRegionClassOpen((open) => !open)}
                        >
                            <span className={styles.builderGroupLabel}>
                                {t('builder.misc.region')} / {t('builder.misc.class')}
                            </span>
                            <span className={styles.builderGroupValue}>{regionClassSummary}</span>
                            <span className={styles.builderGroupChevron} aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M7 10l5 5 5-5z" />
                                </svg>
                            </span>
                        </button>
                        <div className={styles.builderGroupBody} id="builder-region-class">
                            <div className="me-3">
                                <FloatingLabel label={t('builder.misc.region')}>
                                    <Select
                                        instanceId="this-is-just-here-so-react-doesnt-yell-at-me"
                                        id="region"
                                        name="region"
                                        key={`region-${regionSelectKey}-${czOpen ? 'o' : 'c'}`}
                                        options={regions}
                                        value={
                                            czOpen && regionValue === 2
                                                ? { value: 2, label: t('builder.regions.darkestDepths') }
                                                : czOpen && regionValue === 3
                                                  ? { value: 3, label: t('builder.regions.celestialZenith') }
                                                  : regions.find((r) => r.value === regionValue)
                                        }
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                        menuPosition="fixed"
                                        theme={(theme) => ({
                                            ...theme,
                                            borderRadius: 0,
                                            colors: {
                                                ...theme.colors,
                                                primary: 'var(--text-1)',
                                                primary25: 'var(--surface-2)',
                                                neutral0: 'var(--glass-menu)',
                                                neutral5: 'var(--glass-2)',
                                                neutral10: 'var(--glass-2)',
                                                neutral20: 'var(--control-border)',
                                                neutral30: 'var(--control-border-hover)',
                                                neutral60: 'var(--text-2)',
                                                neutral80: 'var(--text-1)',
                                            },
                                        })}
                                        styles={{
                                            container: (base) => ({ ...base, width: '100%', minWidth: 150 }),
                                            control: (base) => ({ ...base, minHeight: 42, height: 42 }),
                                            valueContainer: (base) => ({
                                                ...base,
                                                height: 42,
                                                paddingTop: 0,
                                                paddingBottom: 0,
                                            }),
                                            indicatorsContainer: (base) => ({ ...base, height: 42 }),
                                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                            menu: (base) => ({ ...base, zIndex: 9999 }),
                                        }}
                                        onChange={regionChanged}
                                    />
                                </FloatingLabel>
                            </div>
                            {czOpen ? (
                                <div className={styles.czTreeSelector}>
                                    <FloatingLabel label={t('builder.misc.tree')}>
                                        <Select
                                            instanceId="cz-tree"
                                            name="czTree"
                                            options={czTrees.map((t) => ({ value: t.tree, label: t.tree }))}
                                            value={
                                                czActiveTree
                                                    ? { value: czActiveTree.tree, label: czActiveTree.tree }
                                                    : null
                                            }
                                            onChange={(opt) => setCzSelectedTree(opt.value)}
                                            isSearchable={false}
                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                            menuPosition="fixed"
                                            theme={(theme) => ({
                                                ...theme,
                                                borderRadius: 0,
                                                colors: {
                                                    ...theme.colors,
                                                    primary: 'var(--text-1)',
                                                    primary25: 'var(--surface-2)',
                                                    neutral0: 'var(--glass-menu)',
                                                    neutral5: 'var(--glass-2)',
                                                    neutral10: 'var(--glass-2)',
                                                    neutral20: 'var(--control-border)',
                                                    neutral30: 'var(--control-border-hover)',
                                                    neutral60: 'var(--text-2)',
                                                    neutral80: 'var(--text-1)',
                                                },
                                            })}
                                            styles={{
                                                container: (base) => ({ ...base, width: '100%', minWidth: 180 }),
                                                control: (base) => ({ ...base, minHeight: 42, height: 42 }),
                                                valueContainer: (base) => ({
                                                    ...base,
                                                    height: 42,
                                                    paddingTop: 0,
                                                    paddingBottom: 0,
                                                }),
                                                indicatorsContainer: (base) => ({ ...base, height: 42 }),
                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                menu: (base) => ({ ...base, zIndex: 9999 }),
                                            }}
                                        />
                                    </FloatingLabel>
                                </div>
                            ) : (
                                <div>
                                    <SelectInput
                                        name="class"
                                        floatingLabel={t('builder.misc.class')}
                                        noneOption={true}
                                        widthToOptions
                                        sortableStats={classes}
                                        value={
                                            gameClass != 'none'
                                                ? gameClass.charAt(0).toUpperCase() + gameClass.slice(1)
                                                : 'None'
                                        }
                                        onChange={classChanged}
                                    />
                                </div>
                            )}
                            {gameClass == 'none' || regionValue === 1 ? (
                                ''
                            ) : (
                                <div className="ms-3">
                                    <SelectInput
                                        name="spec"
                                        floatingLabel={t('database.filters.spec')}
                                        noneOption={true}
                                        sortableStats={currentSpecOptions}
                                        value={spec || 'None'}
                                        onChange={specChanged}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.builderToggles}>
                        <label className={`${styles.delveToggle} ${delveOpen ? styles.delveToggleActive : ''} ms-3`}>
                            <input
                                type="checkbox"
                                checked={delveOpen}
                                onChange={(e) => {
                                    setDelveOpen(e.target.checked);
                                    // The toggle only decides whether the
                                    // picks apply; the picks themselves stay
                                    // in state and come back when re-ticked.
                                    scheduleStatsRecalc();
                                }}
                                aria-label={t('builder.misc.delveInfusions')}
                            />
                            {t('builder.misc.delveInfusions')}
                        </label>
                        <label className={`${styles.delveToggle} ${basicOpen ? styles.delveToggleActive : ''} ms-3`}>
                            <input
                                type="checkbox"
                                checked={basicOpen}
                                onChange={(e) => {
                                    setBasicOpen(e.target.checked);
                                    scheduleStatsRecalc();
                                }}
                                aria-label={t('builder.misc.infusions')}
                            />
                            {t('builder.misc.infusions')}
                        </label>
                        <label className={`${styles.delveToggle} ${revelation ? styles.delveToggleActive : ''} ms-3`}>
                            <input
                                type="checkbox"
                                name="revelation"
                                value="1"
                                checked={revelation}
                                onChange={revelationChanged}
                                aria-label={t('builder.misc.revelation')}
                            />
                            {t('builder.misc.revelation')}
                        </label>
                    </div>
                </div>
                <BuilderHeader
                    buildNameRef={buildNameRef}
                    setBuildName={setBuildNameFiltered}
                    nameSignal={nameSignal}
                    onFiltered={triggerRedX}
                    parentLoaded={parentLoaded}
                    build={build}
                    savedName={savedName}
                />
                <div className={`${styles.builderImportGroup}${importOpen ? ' ' + styles.builderGroupOpen : ''}`}>
                    <button
                        type="button"
                        className={styles.builderGroupToggle}
                        aria-expanded={importOpen}
                        aria-controls="builder-import-sets"
                        onClick={() => setImportOpen((open) => !open)}
                    >
                        <span className={styles.builderGroupLabel}>
                            {t('builder.buttons.import')} / {t('builder.sets.skillSets')}
                        </span>
                        <span className={styles.builderGroupChevron} aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M7 10l5 5 5-5z" />
                            </svg>
                        </span>
                    </button>
                    <div className={styles.builderImportBody} id="builder-import-sets">
                        <BuildImportBar embedded />
                        <button
                            type="button"
                            className={styles.setsOpenButton}
                            onClick={() => setSetsOpen(true)}
                            aria-haspopup="dialog"
                        >
                            {t('builder.sets.skillSets')}
                        </button>
                    </div>
                </div>
            </div>

            {setsOpen && (
                <div className={styles.setsModalBackdrop} onClick={() => setSetsOpen(false)}>
                    <div
                        className={styles.setsModalDialog}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('builder.sets.skillSets')}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.setsModalHead}>
                            <span className={styles.setsModalTitle}>{t('builder.sets.skillSets')}</span>
                            <button
                                type="button"
                                className={styles.setsModalClose}
                                onClick={() => setSetsOpen(false)}
                                aria-label={t('common.close')}
                            >
                                ✕
                            </button>
                        </div>
                        <SavedSetsPanel
                            getSnapshot={getSnapshot}
                            deleteSet={deleteSavedSet}
                            applySkillPayload={applySkillPayload}
                            applyDelvePayload={applyDelvePayload}
                            copyBuildSkills={copyBuildSkills}
                        />
                    </div>
                </div>
            )}

            {!czOpen && gameClass != 'none' && (
                <div className="row justify-content-center pt-1 mb-1">
                    <div className="col-12">
                        <div className={styles.skillsSection}>
                            <div className={styles.skillsHeader}>
                                <span className={styles.skillsTitle}>{t('builder.skills.title')}</span>{' '}
                                <span className={styles.skillTotal}>
                                    {Object.values(skillPoints).reduce((sum, pts) => sum + pts, 0)} / {MAX_SKILL_POINTS}{' '}
                                    {t('builder.skills.pointsSpent')}
                                </span>
                                {regionValue >= 3 && (
                                    <span className={styles.skillTotal}>
                                        {Object.keys(enhancements).length} / {MAX_ENHANCEMENT_POINTS}{' '}
                                        {t('builder.skills.enhancementPointsUsed')}
                                    </span>
                                )}
                                {Object.values(skillPoints).reduce((sum, pts) => sum + pts, 0) > MAX_SKILL_POINTS && (
                                    <span className="text-danger fw-bold">
                                        {t('builder.skills.tooManySkillPoints')}
                                    </span>
                                )}
                                {Object.keys(enhancements).length > MAX_ENHANCEMENT_POINTS && (
                                    <span className="text-danger fw-bold">
                                        {t('builder.skills.tooManyEnhancementPoints')}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className={styles.skillActionButton}
                                    onClick={() => setAllSkillPoints(false)}
                                >
                                    {t('builder.skills.clearAll')}
                                </button>
                            </div>
                            {!skillsData ? (
                                <div className={styles.skillsLoading}>{t('builder.skills.loading')}</div>
                            ) : (
                                <div className={styles.skillsGrid}>
                                    {classSkillList.map((skill) => {
                                        const maxPoints = Math.max(0, (skill.descriptions || []).length - 1);
                                        if (maxPoints === 0) return '';
                                        const points = skillPoints[skill.scoreboardId] || 0;
                                        const enhanced = Boolean(enhancements[skill.scoreboardId]);
                                        const enhanceDisabled = points < 1;
                                        const tooltip = [skill.simpleDescription].filter(Boolean).join('\n\n');
                                        const dragging =
                                            dragState &&
                                            dragState.container === classOrderContainer &&
                                            dragState.key === skill.scoreboardId;
                                        const over =
                                            dragTarget &&
                                            dragTarget.container === classOrderContainer &&
                                            dragTarget.key === skill.scoreboardId;
                                        return (
                                            <div
                                                key={skill.scoreboardId}
                                                className={`${styles.skillRow} ${dragging ? styles.skillDragging : ''}${over ? ` ${styles.skillDragOver}` : ''}`}
                                                title={tooltip}
                                                onDragOver={(e) =>
                                                    classOrderContainer &&
                                                    skillDragOver(
                                                        e,
                                                        classOrderContainer,
                                                        skill.scoreboardId,
                                                        classSkillList,
                                                        (s) => s.scoreboardId
                                                    )
                                                }
                                                onDragLeave={() => skillDragLeave(skill.scoreboardId)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    endSkillDrag();
                                                }}
                                            >
                                                <span
                                                    className={styles.dragHandle}
                                                    draggable
                                                    onDragStart={(e) =>
                                                        startSkillDrag(classOrderContainer, skill.scoreboardId, e)
                                                    }
                                                    onDragEnd={endSkillDrag}
                                                    title={t('builder.skills.dragToReorder')}
                                                >
                                                    ⠿
                                                </span>
                                                <img
                                                    className={styles.skillIcon}
                                                    src={skillIconSrc(skill.displayName || skill.name)}
                                                    alt=""
                                                    width={24}
                                                    height={24}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                                <span className={styles.skillName}>{skill.displayName}</span>
                                                <span className={styles.skillPoints}>
                                                    {points}/{maxPoints}
                                                </span>
                                                <div className={styles.skillChecks}>
                                                    {Array.from({ length: maxPoints }).map((_, i) => (
                                                        <input
                                                            key={i}
                                                            type="checkbox"
                                                            checked={points > i}
                                                            onChange={() => skillPointClicked(skill.scoreboardId, i)}
                                                            aria-label={`${skill.displayName} ${t('builder.skills.point')} ${i + 1}`}
                                                            title={[cleanDescription((skill.descriptions || [])[i])]
                                                                .filter(Boolean)
                                                                .join('\n\n')}
                                                        />
                                                    ))}
                                                </div>
                                                {regionValue >= 3 && (
                                                    <input
                                                        type="checkbox"
                                                        className={styles.skillEnhance}
                                                        checked={enhanced && !enhanceDisabled}
                                                        disabled={enhanceDisabled}
                                                        onChange={(e) =>
                                                            enhancementToggled(skill.scoreboardId, e.target.checked)
                                                        }
                                                        aria-label={`${skill.displayName} ${t('builder.skills.enhancement')}`}
                                                        title={
                                                            points < 1
                                                                ? `${skill.displayName} ${t('builder.skills.enhancementTitle')}\n${t('builder.skills.enhancementRequiresPoint')}`
                                                                : [
                                                                      cleanDescription(
                                                                          (skill.descriptions || [])[maxPoints]
                                                                      ),
                                                                  ]
                                                                      .filter(Boolean)
                                                                      .join('\n\n')
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {(!czOpen && gameClass == 'none') || !spec || currentSpecSkills.length === 0 ? (
                ''
            ) : (
                <div className="row justify-content-center mb-1">
                    <div className="col-12">
                        <div className={styles.skillsSection}>
                            <div className={styles.skillsHeader}>
                                <span className={styles.skillsTitle}>
                                    {spec} {t('database.filters.spec')}
                                </span>
                                <span className={styles.skillTotal}>
                                    {Object.values(specSkillPoints).reduce((sum, pts) => sum + pts, 0)} /{' '}
                                    {MAX_SPEC_POINTS} {t('builder.skills.specPointsSpent')}
                                </span>
                                {Object.values(specSkillPoints).reduce((sum, pts) => sum + pts, 0) >
                                    MAX_SPEC_POINTS && (
                                    <span className="text-danger fw-bold">{t('builder.skills.tooManySpecPoints')}</span>
                                )}
                            </div>
                            <div className={styles.skillsGrid}>
                                {specSkillList.map((skill) => {
                                    const maxPoints = Math.max(0, (skill.descriptions || []).length);
                                    if (maxPoints === 0) return '';
                                    const points = specSkillPoints[skill.scoreboardId] || 0;
                                    const tooltip = [skill.simpleDescription].filter(Boolean).join('\n\n');
                                    const dragging =
                                        dragState &&
                                        dragState.container === specOrderContainer &&
                                        dragState.key === skill.scoreboardId;
                                    const over =
                                        dragTarget &&
                                        dragTarget.container === specOrderContainer &&
                                        dragTarget.key === skill.scoreboardId;
                                    return (
                                        <div
                                            key={skill.scoreboardId}
                                            className={`${styles.skillRow} ${dragging ? styles.skillDragging : ''}${over ? ` ${styles.skillDragOver}` : ''}`}
                                            title={tooltip}
                                            onDragOver={(e) =>
                                                specOrderContainer &&
                                                skillDragOver(
                                                    e,
                                                    specOrderContainer,
                                                    skill.scoreboardId,
                                                    specSkillList,
                                                    (s) => s.scoreboardId
                                                )
                                            }
                                            onDragLeave={() => skillDragLeave(skill.scoreboardId)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                endSkillDrag();
                                            }}
                                        >
                                            <span
                                                className={styles.dragHandle}
                                                draggable
                                                onDragStart={(e) =>
                                                    startSkillDrag(specOrderContainer, skill.scoreboardId, e)
                                                }
                                                onDragEnd={endSkillDrag}
                                                title={t('builder.skills.dragToReorder')}
                                            >
                                                ⠿
                                            </span>
                                            <img
                                                className={styles.skillIcon}
                                                src={skillIconSrc(skill.displayName || skill.name)}
                                                alt=""
                                                width={24}
                                                height={24}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <span className={styles.skillName}>{skill.displayName}</span>
                                            <span className={styles.skillPoints}>
                                                {points}/{maxPoints}
                                            </span>
                                            <div className={styles.skillChecks}>
                                                {Array.from({ length: maxPoints }).map((_, i) => (
                                                    <input
                                                        key={i}
                                                        type="checkbox"
                                                        checked={points > i}
                                                        onChange={() => specSkillPointClicked(skill.scoreboardId, i)}
                                                        aria-label={`${skill.displayName} ${t('builder.skills.point')} ${i + 1}`}
                                                        title={[cleanDescription((skill.descriptions || [])[i])]
                                                            .filter(Boolean)
                                                            .join('\n\n')}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {czOpen && (
                <div className="row justify-content-center pt-1 mb-1">
                    <div className="col-12">
                        <div className={styles.czSection}>
                            <div className={styles.skillsHeader}>
                                <span className={styles.skillsTitle}>
                                    {regionValue === 2
                                        ? t('builder.regions.darkestDepths')
                                        : t('builder.regions.celestialZenith')}
                                </span>
                                <span className={styles.skillTotal}>
                                    {regionValue === 3 ? (
                                        <>
                                            {czActiveCount} / 4 {t('builder.cz.activeAbilities')}
                                            {czActiveCount > 4 && (
                                                <span className="text-danger fw-bold">
                                                    {' '}
                                                    {t('builder.cz.tooManyActives')}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {czActiveCount}{' '}
                                            {czActiveCount === 1
                                                ? t('builder.cz.activeAbility')
                                                : t('builder.cz.activeAbilities')}
                                        </>
                                    )}
                                </span>
                                <button type="button" className={styles.skillActionButton} onClick={clearCz}>
                                    {t('builder.skills.clearAll')}
                                </button>
                            </div>
                            {!czData ? (
                                <div className={styles.skillsLoading}>{t('builder.cz.loading')}</div>
                            ) : (
                                czActiveTree && (
                                    <div className={styles.czTreeSkills}>
                                        {czSkillList.map((ability) => {
                                            const selected = czAbilities[ability.name] !== undefined;
                                            const desc =
                                                (regionValue === 2
                                                    ? ability.depths_description
                                                    : ability.zenith_description) ||
                                                ability.zenith_description ||
                                                '';
                                            const triggerTaken =
                                                ability.trigger !== 'Passive' &&
                                                czData.trees.some(
                                                    (t2) =>
                                                        t2.tree !== czActiveTree.tree &&
                                                        t2.skills.some(
                                                            (s2) =>
                                                                s2.name !== ability.name &&
                                                                czAbilities[s2.name] !== undefined &&
                                                                s2.trigger === ability.trigger
                                                        )
                                                );
                                            const tooltip = [
                                                `${ability.name} (${ability.trigger})`,
                                                formatCzDescription(desc, t),
                                                triggerTaken ? t('builder.cz.triggerTaken') : null,
                                            ]
                                                .filter(Boolean)
                                                .join('\n\n');
                                            const dragging =
                                                dragState &&
                                                dragState.container === czOrderContainer &&
                                                dragState.key === ability.name;
                                            const over =
                                                dragTarget &&
                                                dragTarget.container === czOrderContainer &&
                                                dragTarget.key === ability.name;
                                            return (
                                                <div
                                                    key={ability.name}
                                                    className={`${styles.czSkillRow}${
                                                        triggerTaken && !selected ? ` ${styles.czDisabled}` : ''
                                                    }${dragging ? ` ${styles.skillDragging}` : ''}${
                                                        over ? ` ${styles.skillDragOver}` : ''
                                                    }`}
                                                    title={tooltip}
                                                    onDragOver={(e) =>
                                                        czOrderContainer &&
                                                        skillDragOver(
                                                            e,
                                                            czOrderContainer,
                                                            ability.name,
                                                            czSkillList,
                                                            (a) => a.name
                                                        )
                                                    }
                                                    onDragLeave={() => skillDragLeave(ability.name)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        endSkillDrag();
                                                    }}
                                                >
                                                    <span
                                                        className={styles.dragHandle}
                                                        draggable
                                                        onDragStart={(e) =>
                                                            startSkillDrag(czOrderContainer, ability.name, e)
                                                        }
                                                        onDragEnd={endSkillDrag}
                                                        title={t('builder.skills.dragToReorder')}
                                                    >
                                                        ⠿
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        disabled={triggerTaken && !selected}
                                                        onChange={(e) => czChanged(ability.name, e.target.checked)}
                                                        aria-label={`${ability.name} (${ability.trigger})`}
                                                    />
                                                    <img
                                                        className={`${styles.skillIcon} ${styles.frameCrop}`}
                                                        src={czIconSrc(ability.name)}
                                                        alt=""
                                                        width={26}
                                                        height={26}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                    <span className={styles.skillName}>{ability.name}</span>
                                                    <span className={styles.czTrigger}>{ability.trigger}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="row justify-content-center mb-1">
                <div className="col-4 col-md-3 col-lg-2 text-center">
                    <button
                        type="button"
                        className={styles.shareButton}
                        id="copyLinkForDiscord"
                        onClick={copyBuildDiscord}
                        disabled={!buildContentReady}
                        title={buildContentReady ? '' : t('builder.buttons.shareDisabled')}
                    >
                        <TranslatableText identifier="builder.buttons.copyLinkForDiscord"></TranslatableText>
                    </button>
                </div>
                <div className="col-4 col-md-3 col-lg-2 text-center">
                    <button
                        type="button"
                        className={styles.shareButton}
                        id="saveBuild"
                        onClick={() => saveBuildToServer()}
                        disabled={!buildContentReady || saveState === 'saving'}
                        title={buildContentReady ? '' : t('builder.buttons.saveDisabled')}
                    >
                        {saveState === 'saving'
                            ? t('builder.buttons.saving')
                            : saveState === 'copied'
                              ? t('common.copied')
                              : t('builder.buttons.copySave')}
                    </button>
                </div>
                {activeBuildId && (
                    <div className="col-4 col-md-3 col-lg-2 text-center">
                        <button
                            type="button"
                            className={styles.shareButton}
                            id="saveAsNewCopy"
                            onClick={() => saveBuildToServer(true)}
                            disabled={!buildContentReady || saveState === 'saving'}
                            title={
                                buildContentReady
                                    ? t('builder.buttons.saveAsNewCopyTitle')
                                    : t('builder.buttons.copyDisabled')
                            }
                        >
                            {t('builder.buttons.saveAsNewCopy')}
                        </button>
                    </div>
                )}
                <div className="col-4 col-md-3 col-lg-2 text-center">
                    <input
                        type="button"
                        className={styles.resetButton}
                        value={resetConfirm ? t('common.confirm') : t('common.reset')}
                        onClick={handleResetClick}
                        aria-label={t('builder.buttons.resetBuild')}
                    />
                </div>
            </div>
            <p className={styles.saveStatus} role="status">
                {activeBuildId
                    ? t(ownsBuild ? 'builder.status.editingSaved' : 'builder.status.viewingSaved')
                    : t('builder.status.unsaved')}
            </p>
            {loggedIn === true && (!activeBuildId || canPublicise || ownsBuild) && (
                <div className={`${styles.publiciseRow} mb-1`}>
                    <button
                        type="button"
                        className={`${styles.publiciseBtn}${publicState.isPublic ? ` ${styles.publiciseOn}` : ''}`}
                        onClick={togglePublic}
                        disabled={publiciseState === 'saving'}
                    >
                        {publicState.isPublic ? (
                            <TranslatableText identifier="database.unpublish" />
                        ) : (
                            <TranslatableText identifier="database.publicise" />
                        )}
                    </button>
                    {publicState.isPublic && (
                        <label className={styles.anonCheck}>
                            <input
                                type="checkbox"
                                checked={publicState.anonymous}
                                onChange={toggleAnonymous}
                                disabled={publiciseState === 'saving'}
                            />
                            <TranslatableText identifier="database.anonymousPost" />
                        </label>
                    )}
                    {publicState.isPublic && favState && (
                        <button
                            type="button"
                            className={`${styles.favBtn}${favState.favourite ? ` ${styles.favBtnOn}` : ''}`}
                            onClick={toggleFavourite}
                            disabled={favBusy}
                            aria-label={t('builder.buttons.toggleFavourite')}
                        >
                            <svg viewBox="0 0 512 512" width="14" height="14" aria-hidden="true">
                                <path
                                    fill={favState.favourite ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="36"
                                    d="M47.6 300.4 228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96.5 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"
                                />
                            </svg>
                            <span>{favState.count}</span>
                        </button>
                    )}
                    {publiciseState === 'profanity' && (
                        <span className={styles.publiciseError}>
                            <TranslatableText identifier="database.profanity" />
                        </span>
                    )}
                    {publiciseState === 'error' && (
                        <span className={styles.publiciseError}>
                            <TranslatableText identifier="database.publiciseError" />
                        </span>
                    )}
                </div>
            )}
            {(saveState === 'copied' || saveState === 'error' || saveState === 'duplicate' || savedAnonymous) && (
                <div
                    className={`${styles.copyToast}${
                        saveState === 'error' || saveState === 'duplicate'
                            ? ` ${styles.copyToastError}`
                            : savedAnonymous
                              ? ` ${styles.copyToastWarn}`
                              : ''
                    }`}
                    role="status"
                    aria-live="polite"
                >
                    {saveState === 'error' ? (
                        t('builder.errors.saveFailed')
                    ) : saveState === 'duplicate' ? (
                        <b>{t('builder.errors.duplicateName')}</b>
                    ) : savedAnonymous ? (
                        <>
                            <b>{t('builder.status.notSavedToAccount')}</b>
                            <span>{t('builder.status.notSavedToAccountHint')}</span>
                        </>
                    ) : (
                        <>
                            <b>{t('builder.status.savedBuild')}</b>
                            <span>{t('builder.status.copiedLink')}</span>
                        </>
                    )}
                </div>
            )}
            <div className={splitLayout ? styles.slotsStatsSplit : styles.slotsStats}>
                {splitLayout && <aside className={styles.builderSlots}>{slotsSection}</aside>}
                <div className={styles.builderRest}>
                    {!splitLayout && (
                        <>
                            {slotsSection}
                            {itemTiles}
                            {regionValue >= 3 && charmsSection}
                            {regionValue >= 3 && Object.keys(charmTotals).length > 0 && charmStatsSection}
                        </>
                    )}
                    <div
                        className={
                            splitLayout
                                ? `${styles.statsGrid} row justify-content-center mb-1`
                                : 'row justify-content-center mb-1'
                        }
                    >
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-1`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('misc', e)}
                            onDragOver={(e) => statCardDragOver('misc', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('misc')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.misc"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {miscStats.map((stat) =>
                                itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                )
                            )}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('health', e)}
                            onDragOver={(e) => statCardDragOver('health', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('health')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.health"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {healthStats.map((stat) =>
                                itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                )
                            )}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('dr', e)}
                            onDragOver={(e) => statCardDragOver('dr', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('dr')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.damageReduction"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">
                                <TranslatableText identifier="builder.statCategories.damageReduction.sub"></TranslatableText>
                            </h6>
                            {DRStats.map((stat) =>
                                itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                )
                            )}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('drhn', e)}
                            onDragOver={(e) => statCardDragOver('drhn', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('drhn')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.damageReductionHealthNormalized"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">
                                <TranslatableText identifier="builder.statCategories.damageReductionHealthNormalized.sub"></TranslatableText>
                            </h6>
                            {healthNormalizedDRStats.map((stat) =>
                                itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                )
                            )}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('ehp', e)}
                            onDragOver={(e) => statCardDragOver('ehp', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('ehp')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.effectiveHealth"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {(() => {
                                const unstableEHPTypes = ['meleeEHP', 'projectileEHP', 'magicEHP', 'blastEHP'];
                                let temp = EHPStats.map((stat) => {
                                    let condition = itemsToDisplay.instability && unstableEHPTypes.includes(stat.type);
                                    return itemsToDisplay[stat.type] !== undefined ? (
                                        <div key={stat.type}>
                                            <p
                                                className={`${styles.statRow} mb-0 mt-1 ${condition ? styles.grayedout : ''}`}
                                            >
                                                <b>
                                                    <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                                </b>
                                                <span className={styles.monoValue}>
                                                    {itemsToDisplay[stat.type]}
                                                    {stat.percent ? '%' : ''}
                                                </span>
                                            </p>
                                        </div>
                                    ) : (
                                        ''
                                    );
                                });
                                if (itemsToDisplay.instability) {
                                    let avg = 0;
                                    unstableEHPTypes.forEach((t) => (avg += Number(itemsToDisplay[t])));
                                    avg /= 4;
                                    temp.unshift(
                                        <div key={'unstableEHP'}>
                                            <p className={`${styles.statRow} mb-0 mt-1`}>
                                                <b>
                                                    <TranslatableText
                                                        identifier={'builder.stats.dr-ehp.unstable'}
                                                    ></TranslatableText>
                                                    :{' '}
                                                </b>
                                                <span className={styles.monoValue}>{avg.toFixed(2)}</span>
                                            </p>
                                        </div>
                                    );
                                }
                                return temp;
                            })()}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('melee', e)}
                            onDragOver={(e) => statCardDragOver('melee', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('melee')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.melee"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {meleeStats.map((stat) => {
                                if (
                                    stat.type == 'classAttackDamagePercent' &&
                                    itemsToDisplay.classAttackDamagePercent == 100
                                )
                                    return '';
                                return itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                );
                            })}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('projectile', e)}
                            onDragOver={(e) => statCardDragOver('projectile', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('projectile')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.projectile"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {projectileStats.map((stat) => {
                                if (
                                    stat.type == 'classProjectileDamagePercent' &&
                                    itemsToDisplay.classProjectileDamagePercent == 100
                                )
                                    return '';
                                return itemsToDisplay[stat.type] !== undefined ? (
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                );
                            })}
                        </div>
                        <div
                            className={`${styles.builderStatCard} ${styles.builderStatCol} ${splitLayout ? styles.statCell : 'col-auto'} text-center mx-2 my-1 py-2`}
                            draggable
                            onDragStart={(e) => startStatCardDrag('magic', e)}
                            onDragOver={(e) => statCardDragOver('magic', e)}
                            onDragEnd={endStatCardDrag}
                            style={statCardOrderStyle('magic')}
                        >
                            <h5 className="text-center fw-bold mb-1">
                                <TranslatableText identifier="builder.statCategories.magic"></TranslatableText>
                            </h5>
                            <h6 className="text-center fw-bold">&nbsp;</h6>
                            {magicStats.map((stat) => {
                                if (
                                    stat.type == 'classMagicDamagePercent' &&
                                    itemsToDisplay.classMagicDamagePercent == 100
                                )
                                    return '';
                                return itemsToDisplay[stat.type] !== undefined &&
                                    (stat.type != 'potionDamage' || itemsToDisplay.spellPowerPercent == '100.00') && // only show potion damage if spell power is 100% (default)
                                    (stat.type != 'spellDamage' || itemsToDisplay.potionDamage == '0.00') ? ( // only show spell damage if potion damage is 0
                                    <div key={stat.type}>
                                        <p className={`${styles.statRow} mb-0 mt-1`}>
                                            <b>
                                                <TranslatableText identifier={stat.name}></TranslatableText>:{' '}
                                            </b>
                                            <span className={styles.monoValue}>
                                                {itemsToDisplay[stat.type]}
                                                {stat.percent ? '%' : ''}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    ''
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {splitLayout && (
                <>
                    {regionValue >= 3 && charmsSection}
                    {regionValue >= 3 && Object.keys(charmTotals).length > 0 && charmStatsSection}
                </>
            )}
            {tailSections}
        </form>
    );
}
