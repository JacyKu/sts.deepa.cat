'use client';

// Public custom items database: every player's shareable custom items in one
// browseable grid. The filter UI mirrors the builds database page exactly
// (filter category rows with react-select, a separate search field, and the
// same Search / Reset actions). Cards link to the share view, where logged
// in visitors can copy an item into their own list.
import React from 'react';
import Select from 'react-select';
import DatabaseTabs from '../databaseTabs';
import InfiniteScroll from '../infiniteScroll';
import { FilterRow, selectTheme, selectStyles } from '../builds/filterRow';
import FloatingLabel from '../items/floatingLabel';
import { useTranslation } from '../useTranslation';
import ItemTile from '../items/itemTile';
import CharmTile from '../items/charmTile';
import ConsumableTile from '../items/consumableTile';
import { getStsBase } from '../../utils/base';
import { ITEM_FILTER_OPTIONS } from '../../utils/customItemTypes';
import ci from '../../styles/CustomItems.module.css';
import sf from '../../styles/SearchForm.module.css';
import dbStyles from '../../styles/Database.module.css';
import itemsStyles from '../../styles/Items.module.css';

// Fixed "Sort by" options. Same control as the builds database; custom items
// have no charm power, so the applicable build sorts are favourites/newest.
const SORT_OPTIONS = [
    { value: 'top', labelKey: 'database.sort.top' },
    { value: 'new', labelKey: 'database.sort.new' },
];

export default function CustomItemsDatabase() {
    const base = getStsBase();
    const [rows, setRows] = React.useState([{ key: 0, category: null, value: null }]);
    const [searchName, setSearchName] = React.useState('');
    const [sort, setSort] = React.useState('top');

    const [items, setItems] = React.useState([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);

    const rowsRef = React.useRef(rows);
    rowsRef.current = rows;
    const nameRef = React.useRef(searchName);
    nameRef.current = searchName;
    const sortRef = React.useRef(sort);
    sortRef.current = sort;
    const pageRef = React.useRef(page);
    pageRef.current = page;
    const loadingRef = React.useRef(false);
    const loadSeq = React.useRef(0);

    const t = useTranslation();
    const categories = React.useMemo(
        () => [
            {
                name: 'type',
                labelKey: 'common.type',
                type: 'select',
                options: [{ value: 'Any', label: t('database.any') }, ...ITEM_FILTER_OPTIONS],
            },
        ],
        [t]
    );
    const sortOptions = React.useMemo(
        () => SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        [t]
    );

    // Debounced refetch when filters change (same as the builds database).
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            loadPage(1, true);
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, searchName, sort]);

    function loadPage(nextPage, replace) {
        if (loadingRef.current && !replace) return;
        loadingRef.current = true;
        setLoading(true);
        const seq = ++loadSeq.current;
        const params = new URLSearchParams({ page: String(nextPage), limit: '24', sort: sortRef.current });
        if (nameRef.current.trim()) params.set('q', nameRef.current.trim());
        // Last row wins per category; "Any" means no filter.
        const seen = new Set();
        for (const r of rowsRef.current) {
            if (!r.category || !r.value || r.value === 'Any' || seen.has(r.category)) continue;
            seen.add(r.category);
            params.set(r.category, r.value);
        }

        fetch(`/api/v2/custom-items/public?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                if (seq !== loadSeq.current) return;
                setItems((prev) => (replace ? d.items : [...prev, ...d.items]));
                setHasMore(d.hasMore);
                setPage(nextPage);
                setError(false);
            })
            .catch(() => {
                if (seq === loadSeq.current) setError(true);
            })
            .finally(() => {
                if (seq === loadSeq.current) {
                    loadingRef.current = false;
                    setLoading(false);
                }
            });
    }

    function addFilterRow() {
        setRows((prev) => [...prev, { key: Date.now(), category: null, value: null }]);
    }

    function changeCategory(key, category) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== key) return r;
                const cat = categories.find((c) => c.name === category);
                const first =
                    cat && cat.type === 'select'
                        ? cat.options.map((o) => (typeof o === 'string' ? o : o.value))[0]
                        : null;
                return { ...r, category, value: first };
            })
        );
    }

    function changeValue(key, value) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value: value || null } : r)));
    }

    function deleteRow(key) {
        setRows((prev) => prev.filter((r) => r.key !== key));
    }

    function searchNow() {
        setPage(1);
        loadPage(1, true);
    }

    function resetFilters() {
        // The debounced effect picks up the cleared rows/name and reloads.
        setRows([{ key: Date.now(), category: null, value: null }]);
        setSearchName('');
        setSort('top');
        setPage(1);
    }

    return (
        <div className={dbStyles.page}>
            {/* Same title styling as the builds database page so the two
                pages' header rhythm (title → tabs → content) matches. */}
            <h1 className={dbStyles.title}>{t('customItems.database.title')}</h1>
            <DatabaseTabs active="custom-items" />

            <div className={dbStyles.sortControl}>
                <FloatingLabel label={t('database.filters.sort')}>
                    <Select
                        instanceId="custom-db-sort"
                        options={sortOptions}
                        value={sortOptions.find((o) => o.value === sort) || null}
                        onChange={(opt) => setSort(opt ? opt.value : 'top')}
                        isSearchable={false}
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        theme={selectTheme}
                        styles={selectStyles}
                    />
                </FloatingLabel>
            </div>

            {rows.length > 0 && (
                <div className={dbStyles.rows}>
                    {rows.map((row) => (
                        <div className={dbStyles.rowWrap} key={row.key}>
                            <FilterRow
                                categories={categories}
                                row={row}
                                onChangeCategory={changeCategory}
                                onChangeSlot={() => {}}
                                onChangeValue={changeValue}
                                onDelete={deleteRow}
                                t={t}
                                itemGroups={{}}
                                slotOptions={[]}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className={dbStyles.toolbar}>
                <input
                    type="button"
                    className={dbStyles.addBtn}
                    value={'+ ' + t('common.add')}
                    aria-label={t('customItems.database.addFilter')}
                    onClick={addFilterRow}
                />
            </div>

            <input
                type="text"
                className={dbStyles.searchName}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={t('customItems.search.placeholder')}
                aria-label={t('customItems.database.searchAria')}
            />

            <div className={sf.filterActions}>
                <input type="button" className={sf.submitButton} value={t('common.search')} onClick={searchNow} />
                <input
                    type="button"
                    className={sf.warningButton}
                    value={t('common.reset')}
                    onClick={resetFilters}
                    aria-label={t('customItems.database.resetAria')}
                />
            </div>

            {error ? (
                <p className={dbStyles.error}>{t('customItems.database.loadError')}</p>
            ) : items.length === 0 && loading ? (
                <div className={ci.itemGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className={itemsStyles.skeleton}
                            style={{ width: '100%', minHeight: 200, margin: 0 }}
                        />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className={dbStyles.muted}>{t('customItems.database.empty')}</p>
            ) : (
                <>
                    <InfiniteScroll
                        className={`${itemsStyles.itemsContainer} ${ci.dbTiles}`}
                        hasMore={hasMore}
                        next={() => loadPage(pageRef.current + 1, false)}
                    >
                        {items.map((item) => {
                            // Reuse the exact tile components the items page
                            // renders so the database looks identical to the
                            // regular item search results. The item object is
                            // shaped like a real item entry (type, base_item,
                            // stats, textureToken).
                            const tileItem = {
                                name: item.name,
                                type: item.type,
                                base_item: item.baseItem,
                                stats: item.stats,
                                statColors: item.statColors,
                                textureToken: item.textureToken,
                                isCustomItem: true,
                            };
                            let tile = null;
                            // The tile components are normally authorless
                            // (items page); the custom items database passes
                            // the author so the card shows who made it.
                            const authorName = item.authorName || null;
                            const authorAvatar = item.authorAvatar || null;
                            if (item.type === 'Charm') {
                                tile = (
                                    <CharmTile
                                        key={item.id}
                                        name={item.name}
                                        item={tileItem}
                                        authorName={authorName}
                                        authorAvatar={authorAvatar}
                                    ></CharmTile>
                                );
                            } else if (item.type === 'Consumable' && tileItem.effects) {
                                tile = (
                                    <ConsumableTile
                                        key={item.id}
                                        name={item.name}
                                        item={tileItem}
                                        authorName={authorName}
                                        authorAvatar={authorAvatar}
                                    ></ConsumableTile>
                                );
                            } else {
                                tile = (
                                    <ItemTile
                                        key={item.id}
                                        name={item.name}
                                        item={tileItem}
                                        authorName={authorName}
                                        authorAvatar={authorAvatar}
                                    ></ItemTile>
                                );
                            }
                            // The whole card is the link to the share view.
                            // The tile renders its own name anchor (wiki), so
                            // inner anchors are click-through only via CSS -
                            // the card click below always navigates to the
                            // item's page.
                            return (
                                <div
                                    key={item.id}
                                    className={ci.dbTileWrap}
                                    role="link"
                                    tabIndex={0}
                                    aria-label={`${t('customItems.database.viewItem')} ${item.name}`}
                                    onClick={() => {
                                        window.location.href = `${base}/custom-items/${item.id}`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            window.location.href = `${base}/custom-items/${item.id}`;
                                        }
                                    }}
                                >
                                    {tile}
                                </div>
                            );
                        })}
                    </InfiniteScroll>
                </>
            )}
        </div>
    );
}
