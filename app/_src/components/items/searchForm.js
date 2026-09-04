import React from 'react';
import styles from '../../styles/SearchForm.module.css';
import SelectWithTriggers from './selectWithTriggers';
import SelectInput from './selectInput';
import extras from '../../data/extras.json';
import { isSearchCacheEnabled, SEARCH_CACHE_DATA_KEY } from '../../utils/cachePrefs';

let searchOptionsCache = null;
function getSearchOptions(itemData) {
    if (searchOptionsCache && searchOptionsCache.data === itemData) return searchOptionsCache.options;
    let sortableStats = [];
    let tiers = [];
    let locations = [];
    let pois = [];
    let charmStats = [];
    let baseItems = [];
    let effects = [];
    let charmPowers = [];
    let itemNames = Object.keys(itemData).filter((item) => itemData[item].type != 'Charm');
    let uniqueItemStats = {};
    for (let itemName of itemNames) {
        if (itemData[itemName].stats) {
            Object.keys(itemData[itemName].stats).forEach((stat) => {
                uniqueItemStats[stat] = 1;
            });
        }
    }
    Object.keys(uniqueItemStats).forEach((stat) => {
        sortableStats.push(
            stat
                .split('_')
                .map((part) => part[0].toUpperCase() + part.substring(1))
                .join(' ')
        );
    });
    let uniqueTiers = {};
    Object.keys(itemData)
        .map((item) => itemData[item].tier)
        .filter((tierName) => tierName != undefined)
        .forEach((tierName) => {
            uniqueTiers[tierName] = 1;
        });
    // Remove the Charm tier since there is a checkbox for it.
    delete uniqueTiers.Charm;
    Object.keys(uniqueTiers).forEach((tierName) => tiers.push(tierName));
    let charmNames = Object.keys(itemData).filter((item) => itemData[item].type == 'Charm');
    let uniqueCharmAttributes = {};
    for (let charmName of charmNames) {
        Object.keys(itemData[charmName].stats).forEach((attribute) => {
            uniqueCharmAttributes[attribute] = 1;
        });
    }
    Object.keys(uniqueCharmAttributes).forEach((attribute) => {
        charmStats.push(
            attribute
                .split('_')
                .map((part) => part[0].toUpperCase() + part.substring(1))
                .join(' ')
                .replace(' Flat', '')
                .replace(' Percent', ' %')
        );
    });
    let uniqueEffects = {};
    let consumableNames = Object.keys(itemData).filter((item) => itemData[item].type === 'Consumable');
    for (let name of consumableNames) {
        let item = itemData[name];
        if (Array.isArray(item.effects)) {
            item.effects.forEach((effect) => {
                if (effect.EffectType) {
                    uniqueEffects[effect.EffectType] = 1;
                }
            });
        }
    }
    Object.keys(uniqueEffects).forEach((effect) => {
        let formatted = effect.replace('damage', 'Damage');
        formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
        effects.push(formatted);
    });
    let uniqueLocations = {};
    Object.keys(itemData)
        .map((item) => itemData[item].location)
        .filter((locationName) => locationName != undefined)
        .forEach((locationName) => {
            uniqueLocations[locationName] = 1;
        });
    Object.keys(uniqueLocations).forEach((locationName) => locations.push(locationName));
    let uniquePowers = {};
    Object.keys(itemData)
        .filter((item) => itemData[item].type == 'Charm')
        .forEach((item) => {
            const power = itemData[item].power;
            if (power !== undefined && power !== null) {
                uniquePowers[power] = 1;
            }
        });
    Object.keys(uniquePowers)
        .sort((a, b) => a - b)
        .forEach((power) => charmPowers.push(Number(power)));
    let uniqueBaseItems = {};
    Object.keys(itemData)
        .map((item) => itemData[item].base_item)
        .filter((baseItemName) => baseItemName != undefined)
        .forEach((baseItemName) => {
            uniqueBaseItems[baseItemName] = 1;
        });
    Object.keys(uniqueBaseItems).forEach((baseItemName) => baseItems.push(baseItemName));
    let uniquePois = {};
    Object.keys(extras)
        .filter((extra) => extras[extra].poi != undefined)
        .map((extra) => extras[extra].poi)
        .forEach((poiName) => {
            uniquePois[poiName] = 1;
        });
    Object.keys(uniquePois).forEach((poiName) => pois.push(poiName));
    searchOptionsCache = { data: itemData, options: { sortableStats, tiers, locations, pois, charmStats, baseItems, effects, charmPowers } };
    return searchOptionsCache.options;
}

export default function SearchForm({ update, itemData }) {
    const [itemStatKey, setItemStatKey] = React.useState(getResetKey('search'));
    const [itemTypeKey, setItemTypeKey] = React.useState(getResetKey('itemType'));
    const [regionKey, setRegionKey] = React.useState(getResetKey('region'));
    const [tierKey, setTierKey] = React.useState(getResetKey('tier'));
    const [locationKey, setLocationKey] = React.useState(getResetKey('location'));
    const [poiKey, setPoiKey] = React.useState(getResetKey('poi'));
    const [classKey, setClassKey] = React.useState(getResetKey('class'));
    const [charmStatKey, setCharmStatKey] = React.useState(getResetKey('charmStat'));
    const [charmSkillKey, setCharmSkillKey] = React.useState(getResetKey('charmSkill'));
    // Charm Skill options: every class + spec skill name. Charm stats are
    // keyed by the skill they affect (e.g. "arcane_strike_cooldown_percent"),
    // so the filter matches charms whose stats start with the skill's name.
    // Kept in state so the selects re-render once the fetch resolves.
    const [charmSkills, setCharmSkills] = React.useState([]);
    // Skills grouped by the class they belong to, so the Charm Skill filter
    // only offers the active Charm Class's skills (and never charms from
    // other classes). Bumped when the class select changes to re-derive the
    // visible skill options.
    const [charmSkillsByClass, setCharmSkillsByClass] = React.useState({});
    // Fetch the skill list once for the Charm Skill filter (the fetch
    // triggers a re-render through setCharmSkills, so the filter selects
    // pick the options up).
    React.useEffect(() => {
        let active = true;
        fetch('/api/v1/skills')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!active) return;
                const byClass = {};
                const all = [];
                const seenAll = new Set();
                for (const c of (d && d.classes) || []) {
                    if (!c.className) continue;
                    const list = [];
                    const seen = new Set();
                    for (const s of c.skills || []) {
                        if (s.name && !seen.has(s.name)) {
                            seen.add(s.name);
                            list.push({ value: s.name, label: s.name });
                        }
                    }
                    for (const sp of c.specs || []) {
                        for (const s of sp.specSkills || []) {
                            if (s.name && !seen.has(s.name)) {
                                seen.add(s.name);
                                list.push({ value: s.name, label: s.name });
                            }
                        }
                    }
                    byClass[c.className] = list;
                    for (const o of list) {
                        if (!seenAll.has(o.value)) {
                            seenAll.add(o.value);
                            all.push(o);
                        }
                    }
                }
                setCharmSkillsByClass(byClass);
                setCharmSkills(all);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);
    const [baseItemKey, setBaseItemKey] = React.useState(getResetKey('baseItem'));
    const [effectKey, setEffectKey] = React.useState(getResetKey('effect'));
    const form = React.useRef();
    const searchContainer = React.useRef();

    // The search survives page switches: every submit snapshot is cached and
    // restored on mount (until the user hits Reset) - unless the "Cache
    // searches" setting is off (Settings menu).
    const SEARCH_CACHE_KEY = SEARCH_CACHE_DATA_KEY;
    const savedSearch = React.useRef(null);
    const [restored, setRestored] = React.useState(false);

    const itemTypes = [
        'Helmet',
        'Chestplate',
        'Leggings',
        'Boots',
        { value: 'ALL_MAINHANDS', label: 'All mainhands' },
        { value: 'ALL_MELEE_MAINHANDS', label: 'All melee mainhands' },
        { value: 'Mainhand', label: 'Misc mainhands' },
        'Mainhand Sword',
        'Mainhand Shield',
        'Axe',
        'Pickaxe',
        'Trident',
        'Scythe',
        'Shovel',
        'Bow',
        'Crossbow',
        'Wand',
        'Snowball',
        'Projectile',
        { value: 'ALL_OFFHANDS', label: 'All offhands' },
        { value: 'Offhand', label: 'Misc offhands' },
        'Offhand Sword',
        'Offhand Shield',
        'Alchemist Bag',
        'Consumable',
        'Misc',
        'Charm',
    ];
    // The "Not" filter only makes sense with concrete types, not group tokens.
    const notItemTypes = itemTypes.filter((entry) => typeof entry === 'string');
    const charmClasses = [
        'Alchemist',
        'Mage',
        'Warlock',
        'Rogue',
        'Warrior',
        'Cleric',
        'Scout',
        'Shaman',
        'Generalist',
    ];
    const regions = ['Valley', 'Isles', 'Ring'];
    // The active Charm Class filter. Kept in state (updated by the class
    // select's onChange) because the form's hidden input updates after the
    // re-render, which would lag one selection behind. The DOM is only read
    // as a fallback for restored searches, where the onChange never fires.
    // When set, the Charm Skill filter only offers that class's skills, so
    // charms from other classes can never match.
    const [activeCharmClass, setActiveCharmClass] = React.useState(null);
    let activeCharmClassRead = activeCharmClass;
    if (!activeCharmClassRead && form.current) {
        for (const el of form.current.elements) {
            if (el && /^classSelect-/.test(el.name) && el.value) activeCharmClassRead = el.value;
        }
    }
    const visibleCharmSkills =
        activeCharmClassRead && charmSkillsByClass[activeCharmClassRead]
            ? charmSkillsByClass[activeCharmClassRead]
            : charmSkills;
    const categories = [
        new SearchCategory('Item Type', 'items.searchForm.itemType', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={itemTypeKey}
                    name={`itemTypeSelect-${uniqueKey}`}
                    baseTranslationString="items.type"
                    sortableStats={itemTypes}
                    default={defaultValue && defaultValue['itemTypeSelect']}
                />
            );
        }),
        new SearchCategory('Item Stat', 'items.searchForm.itemStat', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={itemStatKey}
                    name={`itemStatSelect-${uniqueKey}`}
                    sortableStats={sortableStats}
                    default={defaultValue && defaultValue['itemStatSelect']}
                />
            );
        }),
        new SearchCategory('Consumable Effect', 'items.searchForm.effect', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={effectKey}
                    name={`effectSelect-${uniqueKey}`}
                    sortableStats={effects}
                    default={defaultValue && defaultValue['effectSelect']}
                />
            );
        }),
        new SearchCategory('Region', 'items.searchForm.region', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={regionKey}
                    name={`regionSelect-${uniqueKey}`}
                    sortableStats={regions}
                    default={defaultValue && defaultValue['regionSelect']}
                />
            );
        }),
        new SearchCategory('Tier', 'items.searchForm.tier', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={tierKey}
                    name={`tierSelect-${uniqueKey}`}
                    sortableStats={tiers}
                    default={defaultValue && defaultValue['tierSelect']}
                />
            );
        }),
        new SearchCategory('Location', 'items.searchForm.location', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={locationKey}
                    name={`locationSelect-${uniqueKey}`}
                    sortableStats={locations}
                    default={defaultValue && defaultValue['locationSelect']}
                />
            );
        }),
        new SearchCategory('POI', 'items.searchForm.poi', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={poiKey}
                    name={`poiSelect-${uniqueKey}`}
                    sortableStats={pois}
                    default={defaultValue && defaultValue['poiSelect']}
                />
            );
        }),
        new SearchCategory('Charm Stat', 'items.searchForm.charmStat', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={charmStatKey}
                    name={`charmStatSelect-${uniqueKey}`}
                    sortableStats={charmStats}
                    default={defaultValue && defaultValue['charmStatSelect']}
                />
            );
        }),
        new SearchCategory('Charm Skill', 'items.searchForm.charmSkill', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={charmSkillKey}
                    name={`charmSkillSelect-${uniqueKey}`}
                    sortableStats={visibleCharmSkills}
                    default={defaultValue && defaultValue['charmSkillSelect']}
                />
            );
        }),
        new SearchCategory('Charm Class', 'items.searchForm.charmClass', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={classKey}
                    name={`classSelect-${uniqueKey}`}
                    sortableStats={charmClasses}
                    onChange={(option) => setActiveCharmClass(option ? option.value : null)}
                    default={defaultValue && defaultValue['classSelect']}
                />
            );
        }),
        new SearchCategory('Base Item', 'items.searchForm.baseItem', (uniqueKey, defaultValue) => {
            return (
                <SelectInput
                    key={baseItemKey}
                    name={`baseItemSelect-${uniqueKey}`}
                    sortableStats={baseItems}
                    default={defaultValue && defaultValue['baseItemSelect']}
                />
            );
        }),
        new SearchCategory('Quest ID', 'items.searchForm.questId', (uniqueKey, defaultValue) => {
            return (
                <input
                    type="text"
                    name={`questIdSelect-${uniqueKey}`}
                    className={styles.questIdInput}
                    defaultValue={(defaultValue && defaultValue['questIdSelect']) || ''}
                    placeholder="e.g. 154, Q154, q154i01"
                    aria-label="Search by quest item ID"
                />
            );
        }),
        new SearchCategory('Charm Power', 'items.searchForm.charmPower', (uniqueKey, defaultValue) => {
            return (
                <div className={styles.powerFilterRow}>
                    <SelectInput
                        key={`powerOp-${itemStatKey}`}
                        name={`charmPowerOperatorSelect-${uniqueKey}`}
                        sortableStats={[
                            { value: '=', label: 'Equals' },
                            { value: '>', label: 'More than' },
                            { value: '>=', label: 'At least' },
                            { value: '<', label: 'Less than' },
                            { value: '<=', label: 'At most' },
                            { value: '!=', label: 'Not equal' },
                        ]}
                        default={defaultValue && defaultValue['charmPowerOperatorSelect']}
                    />
                    <SelectInput
                        key={`powerVal-${itemStatKey}`}
                        name={`charmPowerValueSelect-${uniqueKey}`}
                        sortableStats={charmPowers}
                        default={defaultValue && defaultValue['charmPowerValueSelect']}
                    />
                </div>
            );
        }),
        new SearchCategory('Not', 'items.searchForm.not', (uniqueKey, defaultValue) => {
            return (
                <NotFilterRow
                    key={`notCat-${itemStatKey}`}
                    uniqueKey={uniqueKey}
                    resetKey={itemStatKey}
                    itemTypes={notItemTypes}
                    tiers={tiers}
                    locations={locations}
                    regions={regions}
                    baseItems={baseItems}
                    charmClasses={charmClasses}
                    pois={pois}
                    defaultCategory={defaultValue && defaultValue['notCategorySelect']}
                    defaultValue={defaultValue && defaultValue['notValue']}
                />
            );
        }),
    ];

    const deleteFilter = React.useCallback((key) => {
        setFilters((oldFilters) => {
            // Never allow the UI to end up with zero filter rows.
            if (!oldFilters || oldFilters.length <= 1) {
                return [{ activeCategory: null, selected: null, uniqueKey: new Date().getTime() }];
            }

            const next = oldFilters.filter((f) => f.uniqueKey != key);
            return next.length ? next : [{ activeCategory: null, selected: null, uniqueKey: new Date().getTime() }];
        });
    }, []);

    const [filters, setFilters] = React.useState([
        { activeCategory: null, selected: null, uniqueKey: new Date().getTime() },
    ]);

    function sendUpdate(event = {}) {
        if (event.type === 'submit') {
            event.preventDefault();
        }
        const entries = Object.fromEntries(new FormData(form.current).entries());
        saveSearchCache(entries);
        update(entries);
    }

    // Persist the current filter state so it survives switching pages.
    // The category dropdowns all share the name "categorySelect" (no unique
    // key), so each row's category is derived from its value select's prefix.
    const CATEGORY_BY_PREFIX = {
        itemTypeSelect: 'Item Type',
        itemStatSelect: 'Item Stat',
        effectSelect: 'Consumable Effect',
        regionSelect: 'Region',
        tierSelect: 'Tier',
        locationSelect: 'Location',
        poiSelect: 'POI',
        charmStatSelect: 'Charm Stat',
        charmSkillSelect: 'Charm Skill',
        classSelect: 'Charm Class',
        baseItemSelect: 'Base Item',
        questIdSelect: 'Quest ID',
        charmPowerOperatorSelect: 'Charm Power',
        charmPowerValueSelect: 'Charm Power',
        notCategorySelect: 'Not',
        notValue: 'Not',
    };
    function saveSearchCache(entries) {
        try {
            const rows = [];
            const rowKeys = new Set();
            for (const key of Object.keys(entries)) {
                const m = /-(\d+)$/.exec(key);
                if (m) rowKeys.add(m[1]);
            }
            for (const key of rowKeys) {
                const values = {};
                let category = null;
                for (const [name, value] of Object.entries(entries)) {
                    const m = new RegExp(`-(\\d+)$`).exec(name);
                    if (!m || m[1] !== key) continue;
                    const prefix = name.replace(`-${key}`, '');
                    values[prefix] = value;
                    if (!category && CATEGORY_BY_PREFIX[prefix]) category = CATEGORY_BY_PREFIX[prefix];
                }
                if (category) rows.push({ category, values });
            }
            if (isSearchCacheEnabled()) {
                localStorage.setItem(
                    SEARCH_CACHE_KEY,
                    JSON.stringify({
                        rows,
                        searchName: entries.searchName || '',
                        searchLore: entries.searchLore || '',
                        hideUnobtainable: entries.hideUnobtainable === 'on',
                        hideNonGear: entries.hideNonGear === 'on',
                        hideQuestItems: entries.hideQuestItems === 'on',
                    })
                );
            }
        } catch (e) {}
    }

    // Restore the cached search once after mount: rebuild the filter rows
    // (category + selected value), refill the text inputs / checkboxes and
    // re-apply the results through the parent.
    React.useEffect(() => {
        if (!isSearchCacheEnabled()) return;
        let cache = null;
        try {
            cache = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || 'null');
        } catch (e) {}
        if (!cache || !form.current) return;
        savedSearch.current = cache;

        if (cache.searchName) {
            const nameInput = form.current.elements.searchName;
            if (nameInput) nameInput.value = cache.searchName;
        }
        if (cache.searchLore) {
            const loreInput = form.current.elements.searchLore;
            if (loreInput) loreInput.value = cache.searchLore;
        }
        if (form.current.elements.hideUnobtainable) {
            form.current.elements.hideUnobtainable.checked = Boolean(cache.hideUnobtainable);
        }
        if (form.current.elements.hideNonGear) {
            form.current.elements.hideNonGear.checked = Boolean(cache.hideNonGear);
        }
        if (form.current.elements.hideQuestItems) {
            form.current.elements.hideQuestItems.checked = Boolean(cache.hideQuestItems);
        }

        if (cache.rows && cache.rows.length > 0) {
            setFilters(
                cache.rows.map((row) => ({
                    activeCategory: row.category,
                    selected: row.values,
                    uniqueKey: new Date().getTime() + Math.random(),
                }))
            );
        }
        setRestored(true);
    }, []);

    // After the rows have rendered with their defaults, re-apply the cached
    // results so the item list matches the restored form.
    React.useEffect(() => {
        if (!restored) return;
        const cache = savedSearch.current;
        if (!cache) return;
        const entries = {};
        for (const [i, row] of cache.rows.entries()) {
            const key = String(i);
            entries[`categorySelect-${key}`] = row.category;
            for (const [prefix, value] of Object.entries(row.values)) {
                entries[`${prefix}-${key}`] = value;
            }
        }
        entries.searchName = cache.searchName || '';
        entries.searchLore = cache.searchLore || '';
        if (cache.hideUnobtainable) entries.hideUnobtainable = 'on';
        if (cache.hideNonGear) entries.hideNonGear = 'on';
        if (cache.hideQuestItems) entries.hideQuestItems = 'on';
        update(entries);
    }, [restored]);

    function getResetKey(name) {
        return name + new Date();
    }

    function resetForm() {
        try {
            if (isSearchCacheEnabled()) localStorage.removeItem(SEARCH_CACHE_KEY);
        } catch (e) {}
        savedSearch.current = null;
        setItemStatKey(getResetKey('search'));
        setItemTypeKey(getResetKey('itemType'));
        setRegionKey(getResetKey('region'));
        setTierKey(getResetKey('tier'));
        setLocationKey(getResetKey('location'));
        setPoiKey(getResetKey('poi'));
        setClassKey(getResetKey('class'));
        setCharmStatKey(getResetKey('charmStat'));
        setCharmSkillKey(getResetKey('charmSkill'));
        setBaseItemKey(getResetKey('baseItem'));
        setEffectKey(getResetKey('effects'));
        setFilters([{ activeCategory: null, selected: null, uniqueKey: new Date().getTime() }]);
    }

    function disableRightClick(event) {
        event.preventDefault();
    }

    const { sortableStats, tiers, locations, pois, charmStats, baseItems, effects, charmPowers } = getSearchOptions(itemData);

    function addFilter() {
        setFilters((oldFilters) => [
            ...oldFilters,
            { activeCategory: null, selected: null, uniqueKey: new Date().getTime() },
        ]);
    }

    return (
        <form
            className={styles.searchForm}
            onSubmit={sendUpdate}
            onReset={resetForm}
            onContextMenu={disableRightClick}
            ref={form}
        >
            <div className={styles.searchContainer} ref={searchContainer}>
                {filters.map((f) => (
                    <div className={styles.filterEntry} key={`div-${f.uniqueKey}`}>
                        <SelectWithTriggers
                            className="w-100"
                            key={f.uniqueKey}
                            name="categorySelect"
                            opts={categories}
                            index={f.uniqueKey}
                            deleteCallback={deleteFilter}
                            regenKey={activeCharmClass}
                            defaultValue={
                                f.activeCategory ? { value: f.activeCategory, label: f.activeCategory } : null
                            }
                            childDefault={f.selected || null}
                        />
                    </div>
                ))}
            </div>

            <div className={styles.filterToolbar}>
                <input
                    className={styles.addFilterButton}
                    type="button"
                    value="+ Add"
                    aria-label="Add filter"
                    onClick={addFilter}
                />
            </div>

            <input
                type="text"
                name="searchName"
                className={styles.searchField}
                placeholder="Search Name"
                aria-label="Search by item name"
                autoFocus
            />
            <input
                type="text"
                name="searchLore"
                className={styles.searchField}
                placeholder="Search Lore"
                aria-label="Search by lore text"
            />
            <div className={styles.filterActions}>
                <input className={styles.submitButton} type="submit" value="Search" />
                <input className={styles.warningButton} type="reset" value="Reset" aria-label="Reset all filters" />
            </div>
            <div className={styles.toggleRow}>
                <label className={styles.toggleLabel}>
                    <input type="checkbox" name="hideUnobtainable" onChange={sendUpdate} /> Hide unobtainable
                </label>
                <label className={styles.toggleLabel}>
                    <input type="checkbox" name="hideNonGear" onChange={sendUpdate} /> Hide non-gear items
                </label>
                <label className={styles.toggleLabel}>
                    <input type="checkbox" name="hideQuestItems" onChange={sendUpdate} /> Hide quest items
                </label>
            </div>
        </form>
    );

    /* function generateRegions() {
        regions = [];
        let uniqueRegions = {
            Valley: 1,
            Isles: 1,
            Ring: 1
        };
        Object.keys(itemData).map(item => itemData[item].region).filter(regionName => regionName != undefined).forEach(regionName => {
            uniqueRegions[regionName] = 1;
        });
        Object.keys(uniqueRegions).forEach(regionName => regions.push(regionName));
    } */

    // Charm Skill options: fetch the skill list once (the fetch triggers a
    // re-render through setCharmSkills, so the filter selects pick it up).
    React.useEffect(() => {
        let active = true;
        fetch('/api/v1/skills')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!active) return;
                const seen = new Set();
                const options = [];
                for (const c of (d && d.classes) || []) {
                    for (const s of c.skills || []) {
                        if (s.name && !seen.has(s.name)) {
                            seen.add(s.name);
                            options.push({ value: s.name, label: s.name });
                        }
                    }
                    for (const sp of c.specs || []) {
                        for (const s of sp.specSkills || []) {
                            if (s.name && !seen.has(s.name)) {
                                seen.add(s.name);
                                options.push({ value: s.name, label: s.name });
                            }
                        }
                    }
                }
                setCharmSkills(options);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);
}

class SearchCategory {
    constructor(name, translatableName, spawnChildren) {
        this.name = name;
        this.translatableName = translatableName;
        this.spawnChildren = spawnChildren;
    }

    select(uniqueKey, defaultValue) {
        return this.spawnChildren(uniqueKey, defaultValue);
    }
}

function NotFilterRow({
    uniqueKey,
    resetKey,
    itemTypes,
    tiers,
    locations,
    regions,
    baseItems,
    charmClasses,
    pois,
    defaultCategory,
    defaultValue,
}) {
    const [category, setCategory] = React.useState(defaultCategory || 'Item Type');
    const notValues = {
        'Item Type': itemTypes,
        Tier: tiers,
        Location: locations,
        Region: regions,
        'Base Item': baseItems,
        'Charm Class': charmClasses,
        POI: pois,
    };
    return (
        <div className={styles.powerFilterRow}>
            <SelectInput
                key={`notCat-${resetKey}`}
                name={`notCategorySelect-${uniqueKey}`}
                sortableStats={Object.keys(notValues)}
                default={defaultCategory}
                onChange={(option) => setCategory(option.value)}
            />
            <SelectInput
                key={`notVal-${category}-${resetKey}`}
                name={`notValue-${uniqueKey}`}
                sortableStats={notValues[category]}
                default={defaultValue}
            />
        </div>
    );
}
