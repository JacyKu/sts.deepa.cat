'use client';

import React from 'react';
import Select from 'react-select';
import { WindowedMenuList } from '../items/selectInput';
import sf from '../../styles/SearchForm.module.css';
import styles from '../../styles/Database.module.css';

export const REGIONS = ['Valley', 'Isles', 'Ring', 'Darkest Depths', 'Celestial Zenith'];

// Region names are game data, but their filter labels reuse the builder's
// translations; option values stay English because they are sent to the
// builds API as-is.
const REGION_LABEL_KEYS = {
    Valley: 'builder.regions.valley',
    Isles: 'builder.regions.isles',
    Ring: 'builder.regions.ring',
    'Darkest Depths': 'builder.regions.darkestDepths',
    'Celestial Zenith': 'builder.regions.celestialZenith',
};

// The same react-select look the rest of the app uses (builder, database).
export const selectTheme = (theme) => ({
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

export const selectStyles = {
    container: (base) => ({ ...base, width: '100%' }),
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

// The build filter rows both the database and My Builds pages show.
export function buildSlotOptions(t) {
    return [
        { value: 'Mainhand', label: t('items.type.mainhand') },
        { value: 'Offhand', label: t('items.type.offhand') },
        { value: 'Helmet', label: t('items.type.helmet') },
        { value: 'Chestplate', label: t('items.type.chestplate') },
        { value: 'Leggings', label: t('items.type.leggings') },
        { value: 'Boots', label: t('items.type.boots') },
        { value: 'Charm', label: t('items.type.charm') },
    ];
}

// Options for the build sort control. The database page renders these in a
// fixed "Sort by" dropdown; My Builds keeps them as a filter category row.
export function buildSortOptions(t) {
    return [
        { value: 'top', label: t('database.sort.top') },
        { value: 'new', label: t('database.sort.new') },
    ];
}

export function buildFilterCategories(
    classOptions,
    specMap,
    t,
    { includeSort = true, skillOptions = [], skillMap = null, selectedClass = null } = {}
) {
    const allSpecs = [...new Set(Object.values(specMap).flat())];
    const classSkills = selectedClass && skillMap ? skillMap[selectedClass] : null;
    const skillChoices = classSkills && classSkills.length > 0 ? classSkills : skillOptions;
    const categories = [
        { name: 'class', labelKey: 'database.filters.class', type: 'select', options: classOptions },
        {
            name: 'region',
            labelKey: 'database.filters.region',
            type: 'select',
            options: REGIONS.map((region) => ({ value: region, label: t(REGION_LABEL_KEYS[region]) })),
        },
        { name: 'spec', labelKey: 'database.filters.spec', type: 'select', options: allSpecs },
        {
            name: 'hasCharms',
            labelKey: 'database.filters.hasCharms',
            type: 'select',
            options: [
                { value: '1', label: t('database.yes') },
                { value: '0', label: t('database.no') },
            ],
        },
        { name: 'item', labelKey: 'database.filters.item', type: 'cascade' },
        {
            name: 'skill',
            labelKey: 'database.filters.skill',
            // With a Class filter chosen, only that class's skills (base +
            // its spec skills); without one, every skill (including the
            // class-independent CZ/DD abilities). Falls back to a free-text
            // field when no list was supplied.
            type: skillChoices.length > 0 ? 'select' : 'text',
            options: skillChoices,
        },
        { name: 'author', labelKey: 'database.filters.author', type: 'text' },
    ];
    if (includeSort) {
        categories.push({
            name: 'sort',
            labelKey: 'database.filters.sort',
            type: 'select',
            options: buildSortOptions(t),
        });
    }
    return categories;
}

// One applied filter: a category dropdown + a value control + a delete button,
// mirroring the items page's SelectWithTriggers rows. The Item category is a
// cascade: the slot dropdown fills the rest of the row, and once a slot is
// chosen a second row appears below with the actual item names.
export function FilterRow({
    categories,
    row,
    onChangeCategory,
    onChangeSlot,
    onChangeValue,
    onDelete,
    t,
    itemGroups,
    slotOptions,
}) {
    const cat = categories.find((c) => c.name === row.category);
    const optList =
        cat && cat.type === 'select'
            ? cat.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
            : [];
    const current = optList.find((o) => o.value === row.value) || null;
    const slot = slotOptions.find((o) => o.value === row.slot) || null;
    const itemOpts =
        row.slot && itemGroups[row.slot]
            ? [{ value: 'Any', label: t('database.any') }, ...itemGroups[row.slot].map((n) => ({ value: n, label: n }))]
            : [];
    const currentItem = itemOpts.find((o) => o.value === row.value) || null;
    return (
        <>
            <div className={sf.filterRow}>
                <div className={sf.filterMain}>
                    <Select
                        className={sf.categorySelect}
                        instanceId={`dbcat-${row.key}`}
                        options={categories.map((c) => ({ value: c.name, label: t(c.labelKey) }))}
                        value={cat ? { value: cat.name, label: t(cat.labelKey) } : null}
                        onChange={(opt) => onChangeCategory(row.key, opt ? opt.value : null)}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                        components={{ MenuList: WindowedMenuList }}
                    />
                    <div className={sf.selectorSelect}>
                        {cat && cat.type === 'select' && (
                            <Select
                                instanceId={`dbval-${row.key}`}
                                options={optList}
                                value={current}
                                onChange={(opt) => onChangeValue(row.key, opt ? opt.value : null)}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                theme={selectTheme}
                                styles={selectStyles}
                                components={{ MenuList: WindowedMenuList }}
                            />
                        )}
                        {cat && cat.type === 'cascade' && (
                            <Select
                                instanceId={`dbslot-${row.key}`}
                                options={slotOptions}
                                value={slot}
                                onChange={(opt) => onChangeSlot(row.key, opt ? opt.value : null)}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                theme={selectTheme}
                                styles={selectStyles}
                                components={{ MenuList: WindowedMenuList }}
                            />
                        )}
                        {cat && cat.type === 'text' && (
                            <input
                                className={styles.valueInput}
                                value={row.value || ''}
                                onChange={(e) => onChangeValue(row.key, e.target.value)}
                                placeholder={t(cat.labelKey)}
                                aria-label={t(cat.labelKey)}
                            />
                        )}
                    </div>
                </div>
                <input
                    type="button"
                    className={`${sf.deleteButton} ${sf.filterDelete}`}
                    value="X"
                    onClick={() => onDelete(row.key)}
                    aria-label={t('database.removeFilter')}
                />
            </div>
            {cat && cat.type === 'cascade' && row.slot && (
                <div className={styles.subRow}>
                    <Select
                        instanceId={`dbitem-${row.key}`}
                        options={itemOpts}
                        value={currentItem}
                        onChange={(opt) => onChangeValue(row.key, opt ? opt.value : null)}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                        components={{ MenuList: WindowedMenuList }}
                    />
                </div>
            )}
        </>
    );
}

