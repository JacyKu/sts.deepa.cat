import React from 'react';
import styles from '../../styles/SearchForm.module.css';
import SelectWithTriggers from './selectWithTriggers';
import SelectInput from './selectInput';
import extras from '../../data/extras.json';
import { isSearchCacheEnabled, SEARCH_CACHE_DATA_KEY } from '../../utils/cachePrefs';
import { loadSkills } from '../../utils/siteDataClient';
import { useTranslation } from '../useTranslation';

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
    searchOptionsCache = {
        data: itemData,
        options: { sortableStats, tiers, locations, pois, charmStats, baseItems, effects, charmPowers },
    };
    return searchOptionsCache.options;
}

// Unique, numeric row keys (the cache format encodes them as the trailing
// "-<digits>" of every entry name).
let filterKeyCounter = 0;
function nextFilterKey() {
    filterKeyCounter += 1;
    return String(Date.now()) + String(filterKeyCounter).padStart(3, '0');
}

function emptyFilterRow() {
    return { activeCategory: null, selected: {}, uniqueKey: nextFilterKey() };
}

export default function SearchForm({ update, itemData }) {
    const t = useTranslation();
    // Charm Skill options: every class + spec skill name. Charm stats are
    // keyed by the skill they affect (e.g. "arcane_strike_cooldown_percent"),
    // so the filter matches charms whose stats start with the skill's name.
    const [charmSkills, setCharmSkills] = React.useState([]);
    // Skills grouped by the class they belong to, so the Charm Skill filter
    // only offers the active Charm Class's skills (and never charms from
    // other classes).
    const [charmSkillsByClass, setCharmSkillsByClass] = React.useState({});
    React.useEffect(() => {
        let active = true;
        loadSkills()
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
                            list.push({ value: s.name, label: s.displayName || s.name });
                        }
                    }
                    for (const sp of c.specs || []) {
                        for (const s of sp.specSkills || []) {
                            if (s.name && !seen.has(s.name)) {
                                seen.add(s.name);
                                list.push({ value: s.name, label: s.displayName || s.name });
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

    // The search form is fully controlled (like the database's filter rows):
    // every filter lives in state, so Reset is a plain state reset instead of
    // remounting selects or poking at the DOM.
    const [filters, setFilters] = React.useState([emptyFilterRow()]);
    const [searchName, setSearchName] = React.useState('');
    const [searchLore, setSearchLore] = React.useState('');
    const [toggles, setToggles] = React.useState({
        hideUnobtainable: false,
        hideNonGear: false,
        hideQuestItems: false,
    });
    const form = React.useRef();
    const searchContainer = React.useRef();

    // The search survives page switches: every submit snapshot is cached and
    // restored on mount (until the user hits Reset) - unless the "Cache
    // searches" setting is off (Settings menu).
    const SEARCH_CACHE_KEY = SEARCH_CACHE_DATA_KEY;
    const [restored, setRestored] = React.useState(false);

    const itemTypes = [
        'Helmet',
        'Chestplate',
        'Leggings',
        'Boots',
        { value: 'ALL_MAINHANDS', label: t('items.searchForm.allMainhands') },
        { value: 'ALL_MELEE_MAINHANDS', label: t('items.searchForm.allMeleeMainhands') },
        { value: 'Mainhand', label: t('items.searchForm.miscMainhands') },
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
        { value: 'ALL_OFFHANDS', label: t('items.searchForm.allOffhands') },
        { value: 'Offhand', label: t('items.searchForm.miscOffhands') },
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
    const regions = [
        { value: 'Valley', label: t('builder.regions.valley') },
        { value: 'Isles', label: t('builder.regions.isles') },
        { value: 'Ring', label: t('builder.regions.ring') },
    ];
    // The active Charm Class filter, derived from the rows: it narrows the
    // Charm Skill options so charms from other classes can never match.
    const activeCharmClass = React.useMemo(() => {
        for (const row of filters) {
            const value = row.selected && row.selected.classSelect;
            if (value) return value;
        }
        return null;
    }, [filters]);
    const visibleCharmSkills =
        activeCharmClass && charmSkillsByClass[activeCharmClass]
            ? charmSkillsByClass[activeCharmClass]
            : charmSkills;

    function updateRowValue(uniqueKey, prefix, value) {
        setFilters((rows) =>
            rows.map((row) => {
                const selected = { ...(row.selected || {}) };
                if (row.uniqueKey === uniqueKey) {
                    if (value === null || value === '') delete selected[prefix];
                    else selected[prefix] = value;
                    // The value belongs to the previous category's option list.
                    if (prefix === 'notCategorySelect') delete selected.notValue;
                }
                // A different Charm Class means a different skill list: drop
                // every row's charm skill so a stale skill can't keep
                // filtering invisibly.
                if (prefix === 'classSelect') delete selected.charmSkillSelect;
                return { ...row, selected };
            })
        );
    }

    const deleteFilter = React.useCallback((key) => {
        setFilters((oldFilters) => {
            const next = oldFilters.filter((f) => f.uniqueKey != key);
            return next.length ? next : [emptyFilterRow()];
        });
    }, []);

    // Values a row applies, including the defaults of dependency filters the
    // user never touched (the Not category and the Charm Power operator).
    function rowValues(row) {
        const values = { ...(row.selected || {}) };
        if (row.activeCategory === 'Not') values.notCategorySelect = values.notCategorySelect || 'Item Type';
        if (row.activeCategory === 'Charm Power') values.charmPowerOperatorSelect = values.charmPowerOperatorSelect || '=';
        return values;
    }

    // The entry shape the parent (itemsPage) and the search cache consume:
    // "<prefix>-<rowKey>" per filter value plus the text fields / toggles.
    function buildEntries({ rows = filters, name = searchName, lore = searchLore, state = toggles } = {}) {
        const entries = {};
        for (const row of rows) {
            if (!row.activeCategory) continue;
            entries[`categorySelect-${row.uniqueKey}`] = row.activeCategory;
            for (const [prefix, value] of Object.entries(rowValues(row))) {
                entries[`${prefix}-${row.uniqueKey}`] = value;
            }
        }
        entries.searchName = name || '';
        entries.searchLore = lore || '';
        if (state.hideUnobtainable) entries.hideUnobtainable = 'on';
        if (state.hideNonGear) entries.hideNonGear = 'on';
        if (state.hideQuestItems) entries.hideQuestItems = 'on';
        return entries;
    }

    function saveSearchCache(overrides) {
        if (!isSearchCacheEnabled()) return;
        try {
            const { rows = filters, name = searchName, lore = searchLore, state = toggles } = overrides || {};
            const cacheRows = rows
                .filter((row) => row.activeCategory)
                .map((row) => ({ category: row.activeCategory, values: rowValues(row) }));
            localStorage.setItem(
                SEARCH_CACHE_KEY,
                JSON.stringify({
                    rows: cacheRows,
                    searchName: name || '',
                    searchLore: lore || '',
                    hideUnobtainable: Boolean(state.hideUnobtainable),
                    hideNonGear: Boolean(state.hideNonGear),
                    hideQuestItems: Boolean(state.hideQuestItems),
                })
            );
        } catch (e) {}
    }

    function sendUpdate(event = {}) {
        if (event.type === 'submit') {
            event.preventDefault();
        }
        saveSearchCache();
        update(buildEntries());
    }

    function toggleChanged(key, checked) {
        const state = { ...toggles, [key]: checked };
        setToggles(state);
        saveSearchCache({ state });
        update(buildEntries({ state }));
    }

    // Restore the cached search once after mount, then re-apply it through the
    // parent so the item list matches the restored form.
    React.useEffect(() => {
        if (!isSearchCacheEnabled()) return;
        let cache = null;
        try {
            cache = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || 'null');
        } catch (e) {}
        if (!cache) return;
        const rows = (cache.rows || []).map((row) => ({
            activeCategory: row.category || null,
            selected: row.values || {},
            uniqueKey: nextFilterKey(),
        }));
        if (rows.length > 0) setFilters(rows);
        setSearchName(cache.searchName || '');
        setSearchLore(cache.searchLore || '');
        setToggles({
            hideUnobtainable: Boolean(cache.hideUnobtainable),
            hideNonGear: Boolean(cache.hideNonGear),
            hideQuestItems: Boolean(cache.hideQuestItems),
        });
        setRestored(true);
    }, []);

    React.useEffect(() => {
        if (!restored) return;
        // The state above has been applied in this render, so the entries
        // built from it match the restored form.
        update(buildEntries());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restored]);

    function resetForm() {
        try {
            if (isSearchCacheEnabled()) localStorage.removeItem(SEARCH_CACHE_KEY);
        } catch (e) {}
        setFilters([emptyFilterRow()]);
        setSearchName('');
        setSearchLore('');
        setToggles({ hideUnobtainable: false, hideNonGear: false, hideQuestItems: false });
        // Apply the cleared search immediately: no need to press Search again.
        update({});
    }

    function disableRightClick(event) {
        event.preventDefault();
    }

    const { sortableStats, tiers, locations, pois, charmStats, baseItems, effects, charmPowers } =
        getSearchOptions(itemData);

    function addFilter() {
        setFilters((oldFilters) => [...oldFilters, emptyFilterRow()]);
    }

    const categories = [
        new SearchCategory('Item Type', 'items.searchForm.itemType', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`itemTypeSelect-${uniqueKey}`}
                baseTranslationString="items.type"
                sortableStats={itemTypes}
                value={selected.itemTypeSelect ?? null}
                onChange={(opt) => onValueChange('itemTypeSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Item Stat', 'items.searchForm.itemStat', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`itemStatSelect-${uniqueKey}`}
                sortableStats={sortableStats}
                value={selected.itemStatSelect ?? null}
                onChange={(opt) => onValueChange('itemStatSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory(
            'Consumable Effect',
            'items.searchForm.effect',
            ({ uniqueKey, selected, onValueChange }) => (
                <SelectInput
                    name={`effectSelect-${uniqueKey}`}
                    sortableStats={effects}
                    value={selected.effectSelect ?? null}
                    onChange={(opt) => onValueChange('effectSelect', opt ? opt.value : null)}
                />
            )
        ),
        new SearchCategory('Region', 'items.searchForm.region', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`regionSelect-${uniqueKey}`}
                sortableStats={regions}
                value={selected.regionSelect ?? null}
                onChange={(opt) => onValueChange('regionSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Tier', 'items.searchForm.tier', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`tierSelect-${uniqueKey}`}
                sortableStats={tiers}
                value={selected.tierSelect ?? null}
                onChange={(opt) => onValueChange('tierSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Location', 'items.searchForm.location', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`locationSelect-${uniqueKey}`}
                sortableStats={locations}
                value={selected.locationSelect ?? null}
                onChange={(opt) => onValueChange('locationSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('POI', 'items.searchForm.poi', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`poiSelect-${uniqueKey}`}
                sortableStats={pois}
                value={selected.poiSelect ?? null}
                onChange={(opt) => onValueChange('poiSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Charm Stat', 'items.searchForm.charmStat', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`charmStatSelect-${uniqueKey}`}
                sortableStats={charmStats}
                value={selected.charmStatSelect ?? null}
                onChange={(opt) => onValueChange('charmStatSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Charm Skill', 'items.searchForm.charmSkill', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`charmSkillSelect-${uniqueKey}`}
                sortableStats={visibleCharmSkills}
                value={selected.charmSkillSelect ?? null}
                onChange={(opt) => onValueChange('charmSkillSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Charm Class', 'items.searchForm.charmClass', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`classSelect-${uniqueKey}`}
                sortableStats={charmClasses}
                value={selected.classSelect ?? null}
                onChange={(opt) => onValueChange('classSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Base Item', 'items.searchForm.baseItem', ({ uniqueKey, selected, onValueChange }) => (
            <SelectInput
                name={`baseItemSelect-${uniqueKey}`}
                sortableStats={baseItems}
                value={selected.baseItemSelect ?? null}
                onChange={(opt) => onValueChange('baseItemSelect', opt ? opt.value : null)}
            />
        )),
        new SearchCategory('Quest ID', 'items.searchForm.questId', ({ uniqueKey, selected, onValueChange }) => (
            <input
                type="text"
                name={`questIdSelect-${uniqueKey}`}
                className={styles.questIdInput}
                value={selected.questIdSelect ?? ''}
                onChange={(event) => onValueChange('questIdSelect', event.target.value)}
                placeholder={t('items.searchForm.questIdPlaceholder')}
                aria-label={t('items.searchForm.questIdAria')}
            />
        )),
        new SearchCategory('Charm Power', 'items.searchForm.charmPower', ({ uniqueKey, selected, onValueChange }) => (
            <div className={styles.powerFilterRow}>
                <SelectInput
                    name={`charmPowerOperatorSelect-${uniqueKey}`}
                    sortableStats={[
                        { value: '=', label: t('items.searchForm.operatorEquals') },
                        { value: '>', label: t('items.searchForm.operatorMoreThan') },
                        { value: '>=', label: t('items.searchForm.operatorAtLeast') },
                        { value: '<', label: t('items.searchForm.operatorLessThan') },
                        { value: '<=', label: t('items.searchForm.operatorAtMost') },
                        { value: '!=', label: t('items.searchForm.operatorNotEqual') },
                    ]}
                    value={selected.charmPowerOperatorSelect ?? '='}
                    onChange={(opt) => onValueChange('charmPowerOperatorSelect', opt ? opt.value : '=')}
                />
                <SelectInput
                    name={`charmPowerValueSelect-${uniqueKey}`}
                    sortableStats={charmPowers}
                    value={selected.charmPowerValueSelect ?? null}
                    onChange={(opt) => onValueChange('charmPowerValueSelect', opt ? opt.value : null)}
                />
            </div>
        )),
        new SearchCategory('Not', 'items.searchForm.not', ({ uniqueKey, selected, onValueChange }) => (
            <NotFilterRow
                uniqueKey={uniqueKey}
                selected={selected}
                onValueChange={onValueChange}
                itemTypes={notItemTypes}
                tiers={tiers}
                locations={locations}
                regions={regions}
                baseItems={baseItems}
                charmClasses={charmClasses}
                pois={pois}
            />
        )),
    ];

    return (
        <form
            className={styles.searchForm}
            onSubmit={sendUpdate}
            onContextMenu={disableRightClick}
            ref={form}
        >
            <div className={styles.searchContainer} ref={searchContainer}>
                {filters.map((f) => (
                    <div className={styles.filterEntry} key={`div-${f.uniqueKey}`}>
                        <SelectWithTriggers
                            className="w-100"
                            name="categorySelect"
                            opts={categories}
                            index={f.uniqueKey}
                            deleteCallback={deleteFilter}
                            category={f.activeCategory}
                            selected={f.selected}
                            onCategoryChange={(category) =>
                                setFilters((rows) =>
                                    rows.map((row) =>
                                        row.uniqueKey === f.uniqueKey
                                            ? { ...row, activeCategory: category, selected: {} }
                                            : row
                                    )
                                )
                            }
                            onValueChange={(prefix, value) => updateRowValue(f.uniqueKey, prefix, value)}
                        />
                    </div>
                ))}
            </div>

            <div className={styles.filterToolbar}>
                <input
                    className={styles.addFilterButton}
                    type="button"
                    value={`+ ${t('common.add')}`}
                    aria-label={t('database.addFilter')}
                    onClick={addFilter}
                />
            </div>

            <input
                type="text"
                name="searchName"
                className={styles.searchField}
                placeholder={t('items.searchForm.searchName')}
                aria-label={t('items.searchForm.searchNameAria')}
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
                autoFocus
            />
            <input
                type="text"
                name="searchLore"
                className={styles.searchField}
                placeholder={t('items.searchForm.searchLore')}
                aria-label={t('items.searchForm.searchLoreAria')}
                value={searchLore}
                onChange={(event) => setSearchLore(event.target.value)}
            />
            <div className={styles.filterActions}>
                <input className={styles.submitButton} type="submit" value={t('common.search')} />
                <input
                    className={styles.warningButton}
                    type="button"
                    value={t('common.reset')}
                    aria-label={t('items.searchForm.resetAria')}
                    onClick={resetForm}
                />
            </div>
            <div className={styles.toggleRow}>
                <label className={styles.toggleLabel}>
                    <input
                        type="checkbox"
                        name="hideUnobtainable"
                        checked={toggles.hideUnobtainable}
                        onChange={(event) => toggleChanged('hideUnobtainable', event.target.checked)}
                    />{' '}
                    {t('items.searchForm.hideUnobtainable')}
                </label>
                <label className={styles.toggleLabel}>
                    <input
                        type="checkbox"
                        name="hideNonGear"
                        checked={toggles.hideNonGear}
                        onChange={(event) => toggleChanged('hideNonGear', event.target.checked)}
                    />{' '}
                    {t('items.searchForm.hideNonGear')}
                </label>
                <label className={styles.toggleLabel}>
                    <input
                        type="checkbox"
                        name="hideQuestItems"
                        checked={toggles.hideQuestItems}
                        onChange={(event) => toggleChanged('hideQuestItems', event.target.checked)}
                    />{' '}
                    {t('items.searchForm.hideQuestItems')}
                </label>
            </div>
        </form>
    );
}

class SearchCategory {
    constructor(name, translatableName, spawnChildren) {
        this.name = name;
        this.translatableName = translatableName;
        this.spawnChildren = spawnChildren;
    }

    select(context) {
        return this.spawnChildren(context);
    }
}

const NOT_CATEGORY_KEYS = {
    'Item Type': 'items.searchForm.itemType',
    Tier: 'items.searchForm.tier',
    Location: 'items.searchForm.location',
    Region: 'items.searchForm.region',
    'Base Item': 'items.searchForm.baseItem',
    'Charm Class': 'items.searchForm.charmClass',
    POI: 'items.searchForm.poi',
};

function NotFilterRow({
    uniqueKey,
    selected,
    onValueChange,
    itemTypes,
    tiers,
    locations,
    regions,
    baseItems,
    charmClasses,
    pois,
}) {
    const t = useTranslation();
    const category = selected.notCategorySelect || 'Item Type';
    const notValues = {
        'Item Type': itemTypes,
        Tier: tiers,
        Location: locations,
        Region: regions,
        'Base Item': baseItems,
        'Charm Class': charmClasses,
        POI: pois,
    };
    const categoryOptions = Object.keys(notValues).map((name) => ({
        value: name,
        label: t(NOT_CATEGORY_KEYS[name]),
    }));
    return (
        <div className={styles.powerFilterRow}>
            <SelectInput
                name={`notCategorySelect-${uniqueKey}`}
                sortableStats={categoryOptions}
                value={category}
                onChange={(opt) => onValueChange('notCategorySelect', opt ? opt.value : 'Item Type')}
            />
            <SelectInput
                name={`notValue-${uniqueKey}`}
                sortableStats={notValues[category]}
                baseTranslationString={category === 'Item Type' ? 'items.type' : undefined}
                value={selected.notValue ?? null}
                onChange={(opt) => onValueChange('notValue', opt ? opt.value : null)}
            />
        </div>
    );
}
