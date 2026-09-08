'use client';

import React from 'react';
import Select from 'react-select';
import styles from '../../styles/CustomItems.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { loadItemSpriteMap } from '../../utils/items/spritesheetMap';
import { getStsBase } from '../../utils/base';
import { useSessionState } from '../header';
import StatFormatter from '../../utils/items/statFormatter';
import { isCustomItemsCacheEnabled, CUSTOM_ITEMS_CACHE_KEY, CUSTOM_ITEMS_DRAFT_KEY } from '../../utils/cachePrefs';

// The custom-items list is personal, so its cache is scoped to the logged-in
// user (a later login as someone else never sees the previous account's
// items). Reading the cache is best-effort; any storage error just means the
// regular network fetch is used.
function readCustomItemsCache(userId) {
    try {
        const raw = window.localStorage.getItem(CUSTOM_ITEMS_CACHE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (entry && entry.userId === userId && Array.isArray(entry.items)) return entry.items;
        return null;
    } catch (e) {
        return null;
    }
}

function writeCustomItemsCache(userId, items) {
    if (!isCustomItemsCacheEnabled()) return;
    try {
        window.localStorage.setItem(
            CUSTOM_ITEMS_CACHE_KEY,
            JSON.stringify({ userId, items, savedAt: Date.now() })
        );
    } catch (e) {
        // storage full/unavailable - the fetch result still displays
    }
}

// Unsaved form draft (name/type/texture/stats mid-edit), restored when you
// come back to the page - same idea as the builder's draft autosave.
function readCustomItemsDraft(userId) {
    try {
        const raw = window.localStorage.getItem(CUSTOM_ITEMS_DRAFT_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        return entry && entry.userId === userId ? entry : null;
    } catch (e) {
        return null;
    }
}

function writeCustomItemsDraft(userId, payload) {
    if (!isCustomItemsCacheEnabled()) return;
    try {
        window.localStorage.setItem(CUSTOM_ITEMS_DRAFT_KEY, JSON.stringify({ ...payload, userId }));
    } catch (e) {
        // storage unavailable; nothing to do
    }
}

function clearCustomItemsDraft(userId) {
    try {
        window.localStorage.removeItem(CUSTOM_ITEMS_DRAFT_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}

const selectTheme = (theme) => ({
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

const selectStyles = {
    container: (base) => ({ ...base, width: '100%' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
    menuList: (base) => ({ ...base, maxHeight: 320 }),
    option: (base) => ({ ...base, padding: '10px 12px' }),
    groupHeading: (base) => ({
        ...base,
        padding: '8px 12px',
        textTransform: 'none',
        fontSize: '0.95em',
        fontWeight: 700,
    }),
    // Same sizing as the app's other dropdowns (items page filters):
    // control 42px tall with matching value/indicator containers.
    control: (base) => ({ ...base, minHeight: 42, height: 42 }),
    valueContainer: (base) => ({
        ...base,
        height: 42,
        paddingTop: 0,
        paddingBottom: 0,
        alignContent: 'center',
    }),
    indicatorsContainer: (base) => ({ ...base, height: 42 }),
};

const ITEM_TYPES = [
    'Offhand',
    'Mainhand',
    'Helmet',
    'Chestplate',
    'Leggings',
    'Boots',
    'Bow',
    'Crossbow',
    'Wand',
    'Trinket',
    'Charm',
    'Consumable',
    'Miscellaneous',
];

function humanizeStat(stat) {
    return stat
        .split('_')
        .filter((part) => part !== 'm' && part !== 'p' && part !== 'bow' && part !== 'tool')
        .map((part) => part.charAt(0).toUpperCase() + part.substring(1))
        .join(' ')
        .replace(' Percent', ' %')
        .replace(' Flat', '')
        .replace(' Base', '');
}

function avatarSrc(item) {
    if (!item.authorAvatar) return null;
    if (item.authorAvatar.startsWith('http')) return item.authorAvatar;
    return `https://cdn.discordapp.com/avatars/${item.userId}/${item.authorAvatar}.png?size=32`;
}

export default function CustomItemsPage({ statCategories }) {
    const session = useSessionState();
    const user = session.user;
    const authChecked = session.checked;
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);

    const [items, setItems] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [copiedId, setCopiedId] = React.useState(null);
    const [addedId, setAddedId] = React.useState(null);
    const [spriteMap, setSpriteMap] = React.useState(null);

    const [name, setName] = React.useState('');
    const [type, setType] = React.useState('Offhand');
    const [textureQuery, setTextureQuery] = React.useState('');
    const [textureToken, setTextureToken] = React.useState(null);
    const [textureName, setTextureName] = React.useState('');
    const [textureOpen, setTextureOpen] = React.useState(false);
    const [statRows, setStatRows] = React.useState([]);
    const [editingId, setEditingId] = React.useState(null);
    // Reset works like the builder's: first click arms it ("Confirm"),
    // second click clears the form.
    const [resetConfirm, setResetConfirm] = React.useState(false);
    const resetTimerRef = React.useRef(null);

    const draftRestoredRef = React.useRef(false);
    const draftReadyRef = React.useRef(false);

    // Fills the form from a stored draft (same account only). Used once on
    // mount when the cache setting is on and a draft exists.
    function applyDraft(draft) {
        setEditingId(draft.editingId || null);
        setName(draft.name || '');
        setType(draft.type || 'Offhand');
        setTextureQuery(draft.textureQuery || '');
        setTextureToken(draft.textureToken || null);
        setTextureName(draft.textureName || '');
        setStatRows(Array.isArray(draft.statRows) ? draft.statRows : []);
        setError(null);
    }

    function draftHasContent() {
        return Boolean(editingId) || Boolean(name.trim()) || Boolean(textureToken) || statRows.length > 0;
    }

    // Restore the unsaved form draft when returning to the page.
    React.useEffect(() => {
        if (!authChecked || !user || draftRestoredRef.current) return;
        draftRestoredRef.current = true;
        if (!isCustomItemsCacheEnabled()) return;
        const draft = readCustomItemsDraft(user.id);
        if (draft) applyDraft(draft);
    }, [authChecked, user]);

    // Autosave the draft while typing; clearing every field (or saving or
    // cancelling) clears the stored draft. The first pass only marks the
    // restore step as done - it must not clear a draft that the restore
    // effect above just applied (effects run in order in the same flush, but
    // the restored state only lands on the next render).
    React.useEffect(() => {
        if (!authChecked || !user || !isCustomItemsCacheEnabled()) return;
        if (!draftReadyRef.current) {
            draftReadyRef.current = true;
            return;
        }
        const userId = user.id;
        if (draftHasContent()) {
            writeCustomItemsDraft(userId, {
                editingId,
                name,
                type,
                textureQuery,
                textureToken,
                textureName,
                statRows,
            });
        } else {
            clearCustomItemsDraft(userId);
        }
    }, [authChecked, user, editingId, name, type, textureQuery, textureToken, textureName, statRows]);

    React.useEffect(() => {
        loadItemSpriteMap().then(setSpriteMap);
    }, []);

    React.useEffect(() => {
        if (!authChecked || !user) return;
        let active = true;
        const userId = user.id;
        // Cache-first: show the stored list immediately (when the "Cache
        // custom items" setting is on), then refresh from the server.
        if (isCustomItemsCacheEnabled()) {
            const cached = readCustomItemsCache(userId);
            if (cached && active) setItems(cached);
        }
        fetch(`${base}/api/v1/custom-items`)
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status))))
            .then((data) => {
                if (!active) return;
                const list = Array.isArray(data.items) ? data.items : [];
                setItems(list);
                writeCustomItemsCache(userId, list);
            })
            .catch(() => {
                if (active) {
                    // Only surface an error when there was no cached list to
                    // fall back on.
                    if (!readCustomItemsCache(userId)) {
                        setItems([]);
                        setError('load');
                    }
                }
            });
        return () => {
            active = false;
        };
    }, [authChecked, user, base]);

    const typeOptions = React.useMemo(() => ITEM_TYPES.map((option) => ({ value: option, label: option })), []);
    const statOptions = React.useMemo(
        () =>
            statCategories.map((category) => ({
                label: category.label,
                options: category.stats.map((stat) => ({ value: stat, label: humanizeStat(stat) })),
            })),
        [statCategories]
    );

    const textureChoices = React.useMemo(() => {
        if (!spriteMap) return [];
        const query = textureQuery.trim().toLowerCase();
        const keys = Object.keys(spriteMap);
        if (!query) return keys.slice(0, 30);
        return keys.filter((key) => key.toLowerCase().includes(query)).slice(0, 50);
    }, [spriteMap, textureQuery]);

    function pickTexture(key) {
        setTextureToken(spriteMap[key]);
        setTextureName(key);
        setTextureQuery(key);
        setTextureOpen(false);
    }

    function updateStatRow(index, field, value) {
        setStatRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    }

    function refreshItems() {
        const userId = user ? user.id : null;
        return fetch(`${base}/api/v1/custom-items`)
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status))))
            .then((data) => {
                const list = Array.isArray(data.items) ? data.items : [];
                setItems(list);
                // Mutations refresh through here, so the cache always tracks
                // saves/edits/deletes.
                if (userId) writeCustomItemsCache(userId, list);
            });
    }

    function startEdit(item) {
        setName(item.name);
        setType(item.type);
        setTextureQuery(item.textureName || item.name);
        setTextureToken(item.textureToken);
        setTextureName(item.textureName || '');
        setStatRows(
            Object.entries(item.stats || {}).map(([key, value]) => ({ key, value: String(value) }))
        );
        setEditingId(item.id);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setEditingId(null);
        setName('');
        setType('Offhand');
        setTextureQuery('');
        setTextureToken(null);
        setTextureName('');
        setStatRows([]);
        setError(null);
    }

    function handleResetClick() {
        if (!resetConfirm) {
            setResetConfirm(true);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(() => setResetConfirm(false), 2500);
            return;
        }
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        setResetConfirm(false);
        cancelEdit();
    }

    // Clear the pending confirm if the form is unmounted mid-arming.
    React.useEffect(() => {
        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, []);

    function saveItem(event) {
        event.preventDefault();
        if (!name.trim() || !textureToken || saving) return;
        // Warn immediately for a name the user already has (duplicates would
        // silently overwrite each other in the builder). The item being
        // edited keeps its own name.
        if (
            items &&
            items.some(
                (item) => item.id !== editingId && item.name.toLowerCase() === name.trim().toLowerCase()
            )
        ) {
            setError('duplicate');
            return;
        }
        const stats = {};
        for (const row of statRows) {
            if (!row.key) continue;
            const value = Number(row.value);
            if (Number.isFinite(value) && value !== 0) {
                stats[row.key] = value;
            }
        }
        setSaving(true);
        setError(null);
        fetch(`${base}/api/v1/custom-items${editingId ? '/' + editingId : ''}`, {
            method: editingId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), type, textureToken, textureName, stats }),
        })
            .then((response) => {
                if (response.ok) return response.json();
                // 409 = the user already has an item with this name.
                return response.json().then(() => {
                    const err = new Error('duplicate');
                    err.code = 'duplicate';
                    throw err;
                });
            })
            .then(() => refreshItems())
            .then(() => cancelEdit())
            .catch((err) => setError(err.code || 'save'))
            .finally(() => setSaving(false));
    }

    function deleteItem(id) {
        fetch(`${base}/api/v1/custom-items/${id}`, { method: 'DELETE' })
            .then((response) => (response.ok ? refreshItems() : Promise.reject(new Error('HTTP ' + response.status))))
            .catch(() => setError('delete'));
    }

    function copyShareLink(item) {
        const url = `${window.location.origin}${base}/custom-items/${item.id}`;
        navigator.clipboard
            .writeText(url)
            .then(() => {
                setCopiedId(item.id);
                setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1500);
            })
            .catch(() => {});
    }

    // Adds the custom item to the builder's build list (localStorage) so it
    // can be equipped on /builder. Only the owner's browser has the item, so
    // the build list import works exactly like it does for regular items.
    function addToBuild(item) {
        try {
            const raw = window.localStorage.getItem('sts.buildList.v1');
            const list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) return;
            if (!list.some((entry) => (typeof entry === 'string' ? entry : entry.name) === item.name)) {
                list.push({ name: item.name, type: item.type });
                window.localStorage.setItem('sts.buildList.v1', JSON.stringify(list));
            }
            setAddedId(item.id);
            setTimeout(() => setAddedId((current) => (current === item.id ? null : current)), 1500);
        } catch (e) {}
    }

    if (!authChecked) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Custom Items</h1>
                <div className={styles.itemGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className={itemsStyles.skeleton}
                            style={{ width: '100%', minHeight: 200, margin: 0 }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Custom Items</h1>
                <div className={styles.loginPrompt}>
                    <p>Log in with Discord to create custom items.</p>
                    <a className={styles.loginBtn} href="/api/auth/discord/login?next=/custom-items">
                        Log in with Discord
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>Custom Items</h1>

                <form className={styles.form} onSubmit={saveItem}>
                    <h2 className={styles.formTitle}>{editingId ? 'Edit item' : 'New item'}</h2>

                    <label className={styles.field}>
                        <span className={styles.fieldLabel}>Name</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="My custom sword"
                            required
                        />
                    </label>

                    <label className={styles.field}>
                        <span className={styles.fieldLabel}>Type</span>
                        <Select
                            instanceId="custom-item-type"
                            name="custom-item-type"
                            options={typeOptions}
                            value={typeOptions.find((option) => option.value === type)}
                            onChange={(option) => setType(option ? option.value : 'Offhand')}
                            isSearchable={false}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            theme={selectTheme}
                            styles={selectStyles}
                        />
                    </label>

                    <div className={styles.field}>
                        <span className={styles.fieldLabel}>Texture</span>
                        <div className={styles.texturePicker}>
                            <div className={styles.textureRow}>
                                <input
                                    type="text"
                                    value={textureQuery}
                                    onChange={(event) => {
                                        setTextureQuery(event.target.value);
                                        setTextureOpen(true);
                                        if (spriteMap[event.target.value] !== textureToken) {
                                            setTextureToken(null);
                                            setTextureName('');
                                        }
                                    }}
                                    onFocus={() => setTextureOpen(true)}
                                    onBlur={() => setTimeout(() => setTextureOpen(false), 150)}
                                    placeholder="Search an item name for its texture"
                                />
                                <div
                                    className={`monumenta-items monumenta-${textureToken || ''} ${styles.texturePreview}`}
                                ></div>
                            </div>
                            {textureOpen && (
                                <div className={styles.textureList}>
                                    {textureChoices.length === 0 ? (
                                        <div className={styles.textureEmpty}>No matching textures</div>
                                    ) : (
                                        textureChoices.map((key) => (
                                            <button
                                                type="button"
                                                key={key}
                                                className={`${styles.textureOption}${key === textureName ? ' ' + styles.textureOptionActive : ''}`}
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    pickTexture(key);
                                                }}
                                            >
                                                <span
                                                    className={`monumenta-items monumenta-${spriteMap[key]} ${styles.textureMini}`}
                                                ></span>
                                                <span className={styles.textureName}>{key}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.field}>
                        <span className={styles.fieldLabel}>Stats</span>
                        {statRows.length === 0 && <p className={styles.muted}>No stats yet - add some below.</p>}
                        {statRows.map((row, index) => (
                            <div key={index} className={styles.statRow}>
                                <Select
                                    instanceId={`custom-item-stat-${index}`}
                                    name={`custom-item-stat-${index}`}
                                    options={statOptions}
                                    value={
                                        row.key
                                            ? statOptions
                                                  .flatMap((group) => group.options)
                                                  .find((option) => option.value === row.key)
                                            : null
                                    }
                                    onChange={(option) => updateStatRow(index, 'key', option ? option.value : '')}
                                    placeholder="Choose a stat"
                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                    menuPosition="fixed"
                                    theme={selectTheme}
                                    styles={selectStyles}
                                />
                                <input
                                    type="number"
                                    step="any"
                                    value={row.value ?? ''}
                                    onChange={(event) => updateStatRow(index, 'value', event.target.value)}
                                    placeholder="Value"
                                />
                                <button
                                    type="button"
                                    className={styles.iconBtn}
                                    onClick={() => setStatRows((rows) => rows.filter((_, i) => i !== index))}
                                    aria-label="Remove stat"
                                >
                                    X
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className={styles.addBtn}
                            onClick={() => setStatRows((rows) => [...rows, { key: '', value: '' }])}
                        >
                            + Add stat
                        </button>
                    </div>

                    {error === 'duplicate' && (
                        <p className={styles.errorText}>
                            You already have a custom item named "{name.trim()}". Pick a different name.
                        </p>
                    )}
                    {error === 'save' && <p className={styles.errorText}>Failed to save the item. Try again.</p>}
                    <div className={styles.formActions}>
                        <span className={styles.formActionWrap}>
                            <button
                                type="submit"
                                className={itemsStyles.shareButton}
                                disabled={!name.trim() || !textureToken || saving}
                            >
                                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save item'}
                            </button>
                        </span>
                        <span className={styles.formActionWrap}>
                            <button
                                type="button"
                                className={itemsStyles.resetButton}
                                onClick={handleResetClick}
                                disabled={saving}
                                aria-label="Reset item form"
                            >
                                {resetConfirm ? 'Confirm' : 'Reset'}
                            </button>
                        </span>
                    </div>
                </form>

                {error === 'load' && <p className={styles.errorText}>Failed to load your custom items.</p>}
                {error === 'delete' && <p className={styles.errorText}>Failed to delete the item.</p>}

                <div className={styles.listHeader}>
                    <h2 className={styles.formTitle}>My items ({items ? items.length : 0})</h2>
                </div>

                {items === null ? (
                    <div className={styles.itemGrid}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className={itemsStyles.skeleton}
                                style={{ width: '100%', minHeight: 200, margin: 0 }}
                            />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <p className={styles.muted}>
                        You have not created any custom items yet. Create one above - it will be linked to your Discord
                        account.
                    </p>
                ) : (
                    <div className={styles.itemGrid}>
                        {items.map((item) => (
                            <div key={item.id} className={styles.customItem}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardTitle} title={item.name}>
                                        {item.name}
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={() => deleteItem(item.id)}
                                        aria-label={`Delete ${item.name}`}
                                    >
                                        X
                                    </button>
                                </div>
                                <div className={styles.cardTags}>
                                    <span className={styles.tag}>{item.type}</span>
                                </div>
                                <div className={styles.cardBody}>
                                    <div className={styles.imageIcon}>
                                        <div className={`monumenta-items monumenta-${item.textureToken}`}></div>
                                    </div>
                                    <div className={styles.stats}>{StatFormatter.formatStats(item.stats)}</div>
                                </div>
                                <div className={styles.cardBottom}>
                                    <span className={styles.author} title={item.authorName || 'You'}>
                                        {avatarSrc(item) && (
                                            <img
                                                className={styles.avatar}
                                                src={avatarSrc(item)}
                                                alt=""
                                                width={18}
                                                height={18}
                                            />
                                        )}
                                        {item.authorName || 'You'}
                                    </span>
                                    <span className={styles.date}>
                                        {new Date(item.createdAt + 'Z').toLocaleDateString()}
                                    </span>
                                </div>
                                <div className={styles.itemActions}>
                                    <button type="button" className={styles.addBtn} onClick={() => startEdit(item)}>
                                        Edit
                                    </button>
                                    <button type="button" className={styles.addBtn} onClick={() => addToBuild(item)}>
                                        {addedId === item.id ? 'Added!' : 'Add to build'}
                                    </button>
                                    <a className={styles.addBtn} href={`${base}/custom-items/${item.id}`}>
                                        View
                                    </a>
                                    <button type="button" className={styles.addBtn} onClick={() => copyShareLink(item)}>
                                        {copiedId === item.id ? 'Copied!' : 'Copy link'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
