'use client';

import styles from '../styles/Items.module.css';
import ItemTile from './items/itemTile';
import MasterworkableItemTile from './items/masterworkableItemTile';
import CharmTile from './items/charmTile';
import ConsumableTile from './items/consumableTile';
import BuildListPanel from './items/buildListPanel';
import SearchForm from './items/searchForm';
import React from 'react';
import InfiniteScroll from './infiniteScroll';
import TranslatableText from './translatableText';
import { useHideSkins } from './items/hideSkinsContext';
import skinNames from '../data/skins.json';

// Skin variants confirmed from the Monumenta wiki "Skins" sections.
const SKIN_NAMES = new Set(skinNames);

// Items whose location marks them as skin variants.
const SKIN_LOCATIONS = new Set([
    'Abyssalskin',
    'Storied Skin',
    'Eternity Skin',
    'Sketched',
    'Halloween Skin',
    'Holiday Skin',
    'Threadwarped Skin',
    'Divine Skin',
    'Greed Skin',
    'Mythic Reliquary',
    'Titanic Skin',
    'Remorseful Skin',
    'Challenger',
]);

// Skinned items whose location looks ordinary (checked against the wiki).
const SKIN_EXCEPTIONS = new Set([
    'Phantasm',
    "Refit King's Crown",
    'Sacrificial Dagger',
]);

// Quest items carry a "* Quest Item *" lore marker and a "#Q<id>I<index>"
// code. The id can be decimal (Q154), hex (QAF), carry letter suffixes
// (Q103n), omit the I separator (Q22801), or be wrapped in <obfuscated> tags.
const QUEST_ID_RE = /#Q([A-Za-z0-9]+?)(?:I\d+)?(?![A-Za-z0-9])/g;

function isQuestItem(item) {
    const text = (item.mmlore || []).join('\n') + '\n' + (item.lore || '');
    return text.includes('* Quest Item *');
}

function getQuestIds(item) {
    const text = ((item.mmlore || []).join('\n') + '\n' + (item.lore || '')).replace(/<[^>]+>/g, '');
    const ids = [];
    let m;
    QUEST_ID_RE.lastIndex = 0;
    while ((m = QUEST_ID_RE.exec(text))) ids.push(m[1]);
    return ids;
}

function extractFilterValues(data, baseKey) {
    return Object.keys(data)
        .filter((key) => key.includes(baseKey))
        .map((key) => data[key]);
}

function getStatValue(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'object' && 'value' in value) {
        return value.value;
    }
    return value;
}

// Type-group filters: selecting one of these matches every item type in the group.
const TYPE_GROUPS = {
    ALL_OFFHANDS: ['Offhand', 'Offhand Sword', 'Offhand Shield'],
    ALL_MELEE_MAINHANDS: [
        'Mainhand',
        'Mainhand Shield',
        'Mainhand Sword',
        'Axe',
        'Pickaxe',
        'Trident',
        'Scythe',
        'Shovel',
    ],
    ALL_MAINHANDS: [
        'Mainhand',
        'Mainhand Shield',
        'Mainhand Sword',
        'Axe',
        'Pickaxe',
        'Trident',
        'Scythe',
        'Shovel',
        'Bow',
        'Snowball',
        'Crossbow',
        'Wand',
        'Alchemist Bag',
    ],
};

// Human-readable ability text for a charm (stat names + values), used to let
// free-text searches match charm abilities.
function buildCharmAbilityText(item) {
    if (!item?.stats) return '';
    const parts = [];
    for (const [stat, v] of Object.entries(item.stats)) {
        const value = typeof v === 'object' && v !== null ? v.value : v;
        if (value === undefined || value === null) continue;
        const human = stat
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        parts.push(`${Number(value) > 0 ? '+' : ''}${value} ${human} (${stat})`);
    }
    return parts.join(', ');
}

let charmAbilityCache = null;
function getCharmAbilityTextMap(itemData) {
    if (charmAbilityCache && charmAbilityCache.data === itemData) return charmAbilityCache.map;
    const map = new Map();
    for (const key of Object.keys(itemData)) {
        if (itemData[key].type === 'Charm') map.set(key, buildCharmAbilityText(itemData[key]).toLowerCase());
    }
    charmAbilityCache = { data: itemData, map };
    return map;
}

function getRelevantItems(data, itemData, hideSkins) {
    let items = Object.keys(itemData);
    items = items.filter((name) => itemData[name].base_item != 'Written Book');

    // "Hide skinned items": drop skin variants by wiki-confirmed name
    // (skins.json), skin-marked location, or known exception items.
    if (hideSkins) {
        items = items.filter((name) => {
            const item = itemData[name];
            if (SKIN_NAMES.has(item.name)) return false;
            if (SKIN_LOCATIONS.has(item.location)) return false;
            if (SKIN_EXCEPTIONS.has(item.name)) return false;
            // Royal Armory: the Queen's items (and Refit King's Crown) are the
            // skins; the King's items are the base.
            if (item.name.startsWith('Queen') && item.location === 'Royal Armory') return false;
            return true;
        });
    }

    if (data.searchName) {
        // Check if the user inputted any "|" to search for multiple item names at once.
        let names = data.searchName.split('|').map((name) => name.toLowerCase().trim());
        const charmAbilityText = getCharmAbilityTextMap(itemData);
        items = items.filter((key) => {
            let result = false;
            names.forEach((term) => {
                if (itemData[key].name.toLowerCase().includes(term)) {
                    result = true;
                    return;
                }
                // Charms can also be found by their ability text.
                const ability = charmAbilityText.get(key);
                if (ability && ability.includes(term)) {
                    result = true;
                }
            });
            return result;
        });
    }

    if (data.searchLore) {
        items = items.filter((name) => itemData[name].lore?.toLowerCase().includes(data.searchLore.toLowerCase()));
    }

    // Quest ID filter: the query matches a substring of any "#Q<id>I<index>"
    // code on the item (e.g. "154", "Q154", "q154i01", "AF").
    let wantedQuestIds = extractFilterValues(data, 'questIdSelect');
    if (wantedQuestIds.length > 0) {
        const query = String(wantedQuestIds[0])
            .trim()
            .toLowerCase()
            .replace(/^#/, '')
            .replace(/^q/, '')
            .replace(/i\d+$/, '');
        if (query) {
            items = items.filter((name) =>
                getQuestIds(itemData[name]).some((id) => id.toLowerCase().includes(query))
            );
        }
    }

    let wantedItemTypes = extractFilterValues(data, 'itemTypeSelect');
    if (wantedItemTypes.length > 0) {
        items = items.filter((name) => {
            const type = itemData[name].type;
            // Type-group tokens expand to several item types; plain entries match directly.
            return wantedItemTypes.some((w) => (TYPE_GROUPS[w] ? TYPE_GROUPS[w].includes(type) : w === type));
        });
    }

    let wantedRegions = extractFilterValues(data, 'regionSelect');
    if (wantedRegions.length > 0) {
        items = items.filter((name) => wantedRegions.includes(itemData[name].region));
    }
    let wantedEffects = extractFilterValues(data, 'effectSelect');

    function toCamelCase(str) {
        return str
            .toLowerCase()
            .split(' ')
            .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
            .join('');
    }

    if (wantedEffects.length > 0) {
        const wantedEffectKeys = wantedEffects.map(toCamelCase);

        items = items.filter(
            (name) =>
                itemData[name].effects &&
                wantedEffectKeys.some((wantedKey) =>
                    itemData[name].effects.some(
                        (effectObj) => effectObj.EffectType.toLowerCase() === wantedKey.toLowerCase()
                    )
                )
        );
    }

    let wantedTiers = extractFilterValues(data, 'tierSelect');
    if (wantedTiers.length > 0) {
        items = items.filter((name) => wantedTiers.includes(itemData[name].tier));
    }

    let wantedLocations = extractFilterValues(data, 'locationSelect');
    if (wantedLocations.length > 0) {
        items = items.filter((name) => wantedLocations.includes(itemData[name].location));
    }

    let wantedPois = extractFilterValues(data, 'poiSelect');
    if (wantedPois.length > 0) {
        items = items.filter((name) => itemData[name].extras?.poi && wantedPois.includes(itemData[name].extras.poi));
    }

    let wantedClasses = extractFilterValues(data, 'classSelect');
    if (wantedClasses.length > 0) {
        items = items.filter((name) => wantedClasses.includes(itemData[name].class_name));
    }

    let wantedBaseItems = extractFilterValues(data, 'baseItemSelect');
    if (wantedBaseItems.length > 0) {
        items = items.filter((name) => wantedBaseItems.includes(itemData[name].base_item));
    }

    // Charm power filters (operator + value pairs, e.g. power >= 8)
    let powerOps = extractFilterValues(data, 'charmPowerOperatorSelect');
    let powerVals = extractFilterValues(data, 'charmPowerValueSelect');
    if (powerOps.length > 0) {
        powerOps.forEach((op, i) => {
            const target = Number(powerVals[i]);
            if (isNaN(target)) return;
            items = items.filter((name) => {
                const power = Number(itemData[name].power);
                switch (op) {
                    case '>':
                        return power > target;
                    case '>=':
                        return power >= target;
                    case '<':
                        return power < target;
                    case '<=':
                        return power <= target;
                    case '!=':
                        return power !== target;
                    default:
                        return power === target;
                }
            });
        });
    }

    // NOT filters (exclude items whose selected field contains the typed value)
    let notCategories = extractFilterValues(data, 'notCategorySelect');
    let notValues = extractFilterValues(data, 'notValue');
    const notFieldMap = {
        'Item Type': (item) => item.type,
        Tier: (item) => item.tier,
        Location: (item) => item.location,
        Region: (item) => item.region,
        'Base Item': (item) => item.base_item,
        'Charm Class': (item) => item.class_name,
        POI: (item) => item.extras?.poi,
    };
    if (notCategories.length > 0) {
        notCategories.forEach((cat, i) => {
            const term = String(notValues[i] || '')
                .trim()
                .toLowerCase();
            const getter = notFieldMap[cat];
            if (!getter || !term) return;
            items = items.filter((name) => {
                const val = getter(itemData[name]);
                return !(val !== undefined && val !== null && String(val).toLowerCase().includes(term));
            });
        });
    }

    // Quick-hide unobtainable items: key items, obfuscated items (Gallery of Fear
    // and Darkest Depths), and Arena of Terth items.
    if (data.hideUnobtainable) {
        items = items.filter((name) => {
            const item = itemData[name];
            return item.tier !== 'Key' && item.tier !== 'Obfuscated' && item.location !== 'Arena of Terth';
        });
    }

    // Quick-hide quest items (lore-marked "* Quest Item *").
    if (data.hideQuestItems) {
        items = items.filter((name) => !isQuestItem(itemData[name]));
    }

    // Quick-hide non-gear items: items with no enchants or stats.
    if (data.hideNonGear) {
        items = items.filter((name) => {
            const stats = itemData[name].stats;
            if (!stats) return false;
            const values = Object.values(stats);
            if (values.length === 0) return false;
            return values.some((v) => {
                const val = typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
                return typeof val === 'number' ? val !== 0 : Boolean(val);
            });
        });
    }

    // Reverse to give higher sorting priority to the earliest filters
    let wantedCharmStats = extractFilterValues(data, 'charmStatSelect').reverse();
    if (wantedCharmStats.length > 0) {
        wantedCharmStats.forEach((stat) => {
            let attributeName = stat
                .split(' ')
                .map((part) => part.toLowerCase())
                .join('_');
            attributeName = attributeName.includes('_%')
                ? attributeName.replace('_%', '_percent')
                : (attributeName += '_flat');
            items = items.filter(
                (name) => itemData[name].type == 'Charm' && itemData[name].stats[attributeName] != undefined
            );
            items = items.sort(
                (item1, item2) =>
                    (itemData[item2].stats[attributeName].value || 0) -
                    (itemData[item1].stats[attributeName].value || 0)
            );
        });
    }

    // Reverse to give higher sorting priority to the earliest filters
    let wantedItemStats = extractFilterValues(data, 'itemStatSelect').reverse();
    if (wantedItemStats.length > 0) {
        wantedItemStats.forEach((stat) => {
            let attributeName = stat.toLowerCase().replaceAll(' ', '_');
            items = items.filter(
                (name) => itemData[name].stats != undefined && typeof itemData[name].stats[attributeName] != 'undefined'
            );
            items = items.sort((item1, item2) => {
                const value2 = Number(getStatValue(itemData[item2].stats[attributeName]) || 0);
                const value1 = Number(getStatValue(itemData[item1].stats[attributeName]) || 0);
                return value2 - value1;
            });
        });
    }

    // Group up masterwork tiers by their name using an object, removing them from items.
    let masterworkItems = {};
    let otherPositionsToRemove = [];
    // Go through the array in reverse order to have the splice work properly
    // (items will go down in position if not removed from the end)
    for (let i = items.length - 1; i >= 0; i--) {
        let name = items[i];
        if (itemData[name].masterwork != undefined) {
            let itemName = itemData[name].name;
            if (!masterworkItems[itemName]) {
                masterworkItems[itemName] = { items: [], lowestPosition: 9999999, lowestPositionName: null };
            }
            masterworkItems[itemName].items.push(itemData[name]);
            if (i < masterworkItems[itemName].lowestPosition) {
                // Remove the old lowest position item
                if (masterworkItems[itemName].lowestPosition < 9999999) {
                    otherPositionsToRemove.push(masterworkItems[itemName].lowestPosition);
                }
                // Set the new lowest position
                masterworkItems[itemName].lowestPosition = i;
                masterworkItems[itemName].lowestPositionName = name;
            } else {
                otherPositionsToRemove.push(i);
            }
        }
    }

    // Remove all the excess items that need to be grouped up
    otherPositionsToRemove = otherPositionsToRemove.sort((pos1, pos2) => pos2 - pos1);
    for (const pos of otherPositionsToRemove) {
        items.splice(pos, 1);
    }

    // Re-insert the groups as arrays into the items array, IN THE CORRECT POSITION.
    let masterworkGroups = Object.keys(masterworkItems).sort(
        (item1, item2) => masterworkItems[item2].lowestPosition - masterworkItems[item1].lowestPosition
    );
    for (const masterworkGroup of masterworkGroups) {
        items.splice(
            items.indexOf(masterworkItems[masterworkGroup].lowestPositionName),
            1,
            masterworkItems[masterworkGroup].items
        );
    }

    return items;
}

export default function ItemsPage({ itemData }) {
    const { hidden: hideSkins } = useHideSkins();
    const [relevantItems, setRelevantItems] = React.useState(() => getRelevantItems({}, itemData, false));
    const [itemsToShow, setItemsToShow] = React.useState(20);
    const itemsToLoad = 20;

    // Re-apply the list when the hide-skins toggle flips. The mount pass is
    // skipped (the useState initializer — or the search restored by SearchForm
    // right after mount — already set the list); every toggle after that
    // recomputes from scratch so enabling AND disabling both reset correctly.
    const prevHideSkins = React.useRef(hideSkins);
    React.useEffect(() => {
        if (prevHideSkins.current === hideSkins) return;
        prevHideSkins.current = hideSkins;
        setRelevantItems(getRelevantItems({}, itemData, hideSkins));
        setItemsToShow(itemsToLoad);
    }, [hideSkins, itemData]);

    function handleChange(data) {
        setRelevantItems(getRelevantItems(data, itemData, hideSkins));
        setItemsToShow(itemsToLoad);
    }

    const showMoreItems = React.useCallback(() => {
        setItemsToShow((s) => s + itemsToLoad);
    }, []);

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1>Monumenta Items</h1>
                <SearchForm update={handleChange} itemData={itemData}></SearchForm>
                <BuildListPanel></BuildListPanel>
                <h4 className={styles.resultCount}>
                    <TranslatableText identifier="items.searchForm.itemsFound"></TranslatableText>{' '}
                    {relevantItems.length}
                </h4>
                {relevantItems.length === 0 ? (
                    <div className={styles.emptyState}>
                        <b>No items found.</b>
                        <br />
                        Try clearing some filters or searching for something else.
                    </div>
                ) : (
                    <InfiniteScroll
                        className={styles.itemsContainer}
                        dataLength={itemsToShow}
                        next={showMoreItems}
                        hasMore={itemsToShow < relevantItems.length}
                        loader={<h4>No items found</h4>}
                    >
                        {relevantItems.slice(0, itemsToShow).map((name) => {
                            if (typeof name == 'object') {
                                return (
                                    <MasterworkableItemTile
                                        key={`${name[0].name}-${name[0].masterwork}`}
                                        name={name[0].name}
                                        item={name}
                                        itemData={itemData}
                                        showListButton
                                    ></MasterworkableItemTile>
                                );
                            }
                            if (itemData[name].type == 'Charm') {
                                return (
                                    <CharmTile
                                        key={name}
                                        name={itemData[name].name}
                                        item={itemData[name]}
                                        showListButton
                                    ></CharmTile>
                                );
                            }
                            if (itemData[name].type == 'Consumable' && itemData[name].effects != undefined) {
                                return (
                                    <ConsumableTile
                                        key={name}
                                        name={name}
                                        item={itemData[name]}
                                        showListButton
                                    ></ConsumableTile>
                                );
                            }
                            return (
                                <ItemTile
                                    key={name}
                                    name={name}
                                    item={itemData[name]}
                                    showListButton
                                ></ItemTile>
                            );
                        })}
                    </InfiniteScroll>
                )}
            </main>
        </div>
    );
}
