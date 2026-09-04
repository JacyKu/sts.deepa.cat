'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import TranslatableText from './translatableText';
import styles from '../styles/Database.module.css';
import itemsStyles from '../styles/Items.module.css';
import { loadItemSpriteMap, getMappedSpriteClass } from '../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../utils/items/minecraftFallback';
import { useCardItemsFirst } from './items/cardItemsFirstContext';
import { useLowResource } from './lowResourceContext';
import Enchants from './items/enchants';
import CharmFormatter from '../utils/items/charmFormatter';

// Per-build-item detail lookup cache, shared across cards.
const itemDetailCache = new Map();

// Tooltips for the card chips need the skills/CZ data (full names +
// descriptions). Fetched once per page load and shared across cards.
let buildDetailPromise = null;

// Strip the formatting glyphs the raw skill/class descriptions use.
function cleanDescription(desc) {
    return String(desc || '')
        .replace(/[\u25B6\u25AA\u25CF\u2022\u25A0\u25C6\u2605\u2606]/g, '\n')
        .replace(/[\u{1F5E1}]/gu, '')
        .replace(/\(\s*\)/g, '')
        .split('\n')
        .map((line) => line.replace(/^[\u25C6\u00B7\u2013\u2014\s]+/, '').trim())
        .filter(Boolean)
        .join('\n');
}

// Replaces #{Common|Uncommon|...} templates in CZ/Depths ability descriptions
// with the value for the Twisted level - rarity is gone, everything is Twisted.
function formatCzDescription(desc) {
    const KEYBINDS = {
        'key.attack': 'Left Button',
        'key.use': 'Right Button',
        'key.swapOffhand': 'Swap',
        'key.drop': 'Drop',
    };
    return String(desc || '')
        .replace(/#\{([^}]+)\}/g, (match, group) => {
            const values = group.split('|');
            const v = values[values.length - 1];
            return v === undefined ? match : v;
        })
        .replace(/key\.\w+/g, (match) => KEYBINDS[match] || match);
}

function loadBuildDetails() {
    if (!buildDetailPromise) {
        buildDetailPromise = Promise.all([
            fetch('/api/v1/skills')
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
            fetch('/api/v1/cz')
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
        ]).then(([skills, cz]) => {
            const skill = new Map();
            const klass = new Map();
            const spec = new Map();
            for (const c of (skills && skills.classes) || []) {
                if (c.className) {
                    const passive = c.classPassive;
                    klass.set(
                        c.className,
                        cleanDescription(passive && Array.isArray(passive.descriptions) ? passive.descriptions[0] : '')
                    );
                }
                for (const s of c.skills || []) {
                    if (s.name && !skill.has(s.name)) {
                        skill.set(s.name, {
                            displayName: s.displayName || s.name,
                            description: cleanDescription(s.simpleDescription),
                        });
                    }
                }
                for (const sp of c.specs || []) {
                    const first = (sp.specSkills || [])[0];
                    if (sp.specName && !spec.has(sp.specName)) {
                        spec.set(sp.specName, first ? cleanDescription(first.simpleDescription) : '');
                    }
                    for (const s of sp.specSkills || []) {
                        if (s.name && !skill.has(s.name)) {
                            skill.set(s.name, {
                                displayName: s.displayName || s.name,
                                description: cleanDescription(s.simpleDescription),
                            });
                        }
                    }
                }
            }
            const czAbilities = new Map();
            for (const t of (cz && cz.trees) || []) {
                for (const a of t.skills || []) {
                    czAbilities.set(a.name, { zenith: a.zenith_description, depths: a.depths_description });
                }
            }
            return { skill, klass, spec, cz: czAbilities };
        });
    }
    return buildDetailPromise;
}

// One build card in the public database / favourites / my-builds grids.
// The optional children render inside the card (after the bottom row), so
// pages like "My Builds" can embed management buttons in the card itself.
// `compareEnabled` (database page) shows the "add to comparison" picker
// button below the layout-swap button.
export default function BuildCard({ build, user, base, onToggleFavourite, onAddCompare, compareActive, children }) {
    const { itemsFirst, toggle: toggleCardLayout } = useCardItemsFirst();
    const { lowRes } = useLowResource();
    const [favBusy, setFavBusy] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const [sideOpen, setSideOpen] = React.useState(false);
    const [side, setSide] = React.useState('right');
    const [spriteMap, setSpriteMap] = React.useState(null);
    const [openItem, setOpenItem] = React.useState(null);
    const [detail, setDetail] = React.useState(null);
    const [buildDetails, setBuildDetails] = React.useState(null);
    const [isTouch, setIsTouch] = React.useState(false);
    // Portal tooltip for chips inside the scrolling side panel: rendered to
    // document.body so it always overlays the card/panel edges instead of
    // being clipped by the panel's overflow.
    const [tip, setTip] = React.useState(null); // { left, top, s }
    const hoverTimer = React.useRef(null);
    const cardRef = React.useRef(null);

    React.useEffect(() => {
        // Touch devices have no hover: the card expands on the first tap and
        // shows its items inline instead of the hover side panel.
        setIsTouch(
            typeof window !== 'undefined' &&
                Boolean(window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches)
        );
    }, []);

    React.useEffect(() => {
        let active = true;
        loadItemSpriteMap().then((map) => {
            if (active) setSpriteMap(map);
        });
        return () => {
            active = false;
        };
    }, []);

    React.useEffect(() => {
        let active = true;
        loadBuildDetails().then((d) => {
            if (active) setBuildDetails(d);
        });
        return () => {
            active = false;
        };
    }, []);

    // Animate the side panel in on the frame after it mounts.
    React.useEffect(() => {
        if (!expanded) return;
        const id = requestAnimationFrame(() => setSideOpen(true));
        return () => {
            cancelAnimationFrame(id);
            setSideOpen(false);
        };
    }, [expanded]);

    function onCardEnter() {
        if (isTouch) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            const rect = cardRef.current?.getBoundingClientRect();
            setSide(rect && rect.right + 340 > window.innerWidth - 8 ? 'left' : 'right');
            setExpanded(true);
        }, 400);
    }

    function onCardLeave() {
        if (isTouch) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
        setExpanded(false);
        setOpenItem(null);
        setDetail(null);
        setTip(null);
    }

    // Touch devices: the first tap on the card expands the items instead of
    // navigating; once expanded, tapping the card's upper area follows the
    // link (item rows stop propagation in their own click handler).
    function onCardClick(event) {
        if (!isTouch || expanded) return;
        event.preventDefault();
        event.stopPropagation();
        setExpanded(true);
    }

    function onRowClick(i, item) {
        if (openItem === i) {
            setOpenItem(null);
            setDetail(null);
            return;
        }
        setOpenItem(i);
        const cacheKey = `${item.n}|${item.pw || ''}`;
        const cached = itemDetailCache.get(cacheKey);
        if (cached) {
            setDetail(cached);
            return;
        }
        const query = new URLSearchParams({ name: item.n });
        if (item.c) {
            query.set('type', 'charm');
            query.set('power', String(item.pw || ''));
        }
        fetch(`/api/v1/items?${query}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((data) => {
                if (data.item) {
                    itemDetailCache.set(cacheKey, data.item);
                    setDetail(data.item);
                }
            })
            .catch(() => {});
    }

    function avatarUrl(id, avatar) {
        if (!id || !avatar) return null;
        return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=32`;
    }

    function toggleFavourite(event) {
        event.preventDefault();
        event.stopPropagation();
        if (favBusy) return;
        // Only signed-in Discord users may like builds; the server enforces
        // this too (401). Without a session the button does nothing.
        if (!user) return;
        setFavBusy(true);
        fetch(`/api/v1/builds/${build.id}/favourite`, {
            method: build.myFavourite ? 'DELETE' : 'POST',
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(() => onToggleFavourite && onToggleFavourite(build.id, !build.myFavourite))
            .catch(() => {})
            .finally(() => setFavBusy(false));
    }

    const displayName = build.name || 'Unnamed build';
    const avatar = avatarUrl(build.authorId, build.authorAvatar);

    // Chip hover tooltips: full name + description for the class, spec and
    // ability chips (abilities are stored as abbreviations).
    const chipTooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };
    const classInfo = buildDetails && build.class ? buildDetails.klass.get(build.class) : null;
    const specInfo = buildDetails && build.spec ? buildDetails.spec.get(build.spec) : null;
    const skillInfo = (s) => (buildDetails ? buildDetails.skill.get(s.f) : null);
    const czInfo = (s) => (buildDetails ? buildDetails.cz.get(s.f) : null);
    const czDescription = (s) => {
        const info = czInfo(s);
        if (!info) return null;
        const raw = build.region === 'Darkest Depths' ? info.depths : info.zenith;
        return formatCzDescription(raw);
    };

    let skills = [];
    if (build.skillsJson || build.skills_json) {
        try {
            const parsed = JSON.parse(build.skillsJson || build.skills_json);
            skills = (Array.isArray(parsed) ? parsed : []).map((s) => {
                if (typeof s === 'string') {
                    // Legacy rows stored plain skill names - abbreviate them.
                    const words = s.split(/\s+/).filter(Boolean);
                    const n =
                        words.length >= 2
                            ? (words[0][0] + words[1][0]).toUpperCase()
                            : (words[0] || '?')[0].toUpperCase();
                    return { n, f: s, g: 'b', e: 0 };
                }
                return s;
            });
        } catch (e) {
            skills = [];
        }
    }

    // Embed chip colors: base / spec / enhanced / CZ (always Twisted).
    const SKILL_COLORS = { b: '#C084FC', s: '#7CC4FF' };
    const CZ_COLOR = '#703663';
    const skillColor = (s) => (s.g === 'c' ? CZ_COLOR : s.e ? '#7EE787' : SKILL_COLORS[s.g] || SKILL_COLORS.b);
    const czIcon = (s) =>
        `${base}/images/cz/${String(s.f || s.n)
            .toLowerCase()
            .replace(/ /g, '_')
            .replace(/'/g, '')}.png`;
    const skillIcon = (s) =>
        `${base}/images/skills/${String(s.f || s.n)
            .toLowerCase()
            .replace(/ /g, '_')
            .replace(/'/g, '')}.png`;
    const treeIcon = (t) => `${base}/images/cz/${String(t).toLowerCase().replace(/ /g, '_').replace(/'/g, '')}.png`;

    let items = [];
    if (build.itemsJson || build.items_json) {
        try {
            const parsed = JSON.parse(build.itemsJson || build.items_json);
            items = (Array.isArray(parsed) ? parsed : []).map((s) => (typeof s === 'string' ? { n: s } : s));
        } catch (e) {
            items = [];
        }
    }

    // Sprite class resolution mirrors the items page: explicit map entry, else
    // a minecraft texture keyed by the base item. Charms fall back to their
    // class default texture on the charmsheet (tier/class/power based), like
    // charmTile does. Before the map has loaded, render a plain placeholder.
    const SLOT_LABELS = {
        mainhand: 'Mainhand',
        offhand: 'Offhand',
        helmet: 'Helmet',
        chestplate: 'Chestplate',
        leggings: 'Leggings',
        boots: 'Boots',
    };
    function doesStyleExist(className) {
        try {
            for (const sheet of document.styleSheets) {
                let rules;
                try {
                    rules = sheet.cssRules;
                } catch (e) {
                    continue;
                }
                if (!rules) continue;
                for (const rule of rules) {
                    if (rule.selectorText === `.${className}`) return true;
                }
            }
        } catch (e) {
            return false;
        }
        return false;
    }
    function charmDefaultClass(item) {
        const tier = item.t || 'Base';
        const cls = item.c || 'Generalist';
        const power = item.pw || 1;
        let image;
        if (tier === 'Epic') {
            image = `Epic-Charm-${power}`;
        } else {
            const prefix = cls === 'Alchemist' ? 'Alch' : cls === 'Generalist' ? 'Gen' : cls;
            image = `${prefix}-Charm${tier === 'Base' ? '' : `-${tier}`}-${power}`;
        }
        return `monumenta-${image}`;
    }
    function itemSprite(item) {
        const mapped = getMappedSpriteClass(spriteMap, item.n);
        if (mapped && doesStyleExist(mapped)) return `monumenta-items ${mapped}`;
        if (spriteMap) {
            if (item.c) {
                const named = `monumenta-${item.n
                    .replaceAll(' ', '-')
                    .replaceAll('_', '-')
                    .replaceAll("'", '')
                    .trim()}`;
                if (doesStyleExist(named)) return `monumenta-charms ${named}`;
                return `monumenta-charms ${charmDefaultClass(item)}`;
            }
            return `minecraft minecraft-${getMinecraftTextureKey(item.b)}`;
        }
        return null;
    }
    const itemStars = (item) => {
        if (item.c) {
            return (Number(item.pw) || 0) > 0 ? (
                <span className={styles.previewStars}>{'★'.repeat(Number(item.pw) || 0)}</span>
            ) : null;
        }
        if (item.sl && SLOT_LABELS[item.sl]) {
            return <span className={styles.previewSlot}>{SLOT_LABELS[item.sl]}</span>;
        }
        return null;
    };

    function renderItemRow(item, i) {
        const cls = itemSprite(item);
        return (
            <div key={i} className={styles.previewRowWrap}>
                <div
                    className={`${styles.previewRow}${openItem === i ? ` ${styles.previewRowOpen}` : ''}`}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRowClick(i, item);
                    }}
                >
                    <span className={styles.previewIcon}>
                        {lowRes ? (
                            <span className={itemsStyles.lowResIcon} aria-hidden="true" />
                        ) : cls ? (
                            <span className={`${styles.previewSprite} ${cls}`} aria-hidden="true" />
                        ) : null}
                    </span>
                    <span className={styles.previewInfo}>
                        <span className={styles.previewName}>{item.n}</span>
                        {itemStars(item)}
                    </span>
                </div>
                {openItem === i && detail && (
                    <div className={styles.itemDetail}>
                        <div className={styles.itemDetailName}>{detail.name || item.n}</div>
                        <div className={styles.itemDetailInfo}>
                            {detail.type ? detail.type.replace('<M>', '') : ''}
                            {detail.type && detail.base_item ? ' - ' : ''}
                            {detail.base_item || ''}
                        </div>
                        {detail.type === 'Charm' ? (
                            <>
                                <div className={styles.itemDetailInfo}>
                                    <span className={styles.previewStars}>{'★'.repeat(Number(item.pw) || 0)}</span>
                                    {detail.class_name ? ` - ${detail.class_name}` : ''}
                                </div>
                                {CharmFormatter.formatCharm(detail.stats)}
                            </>
                        ) : (
                            <Enchants item={detail} />
                        )}
                        <div className={styles.itemDetailInfo}>
                            {detail.region ? `${detail.region} ` : ''}
                            {detail.tier || ''}
                        </div>
                        <div className={styles.itemDetailInfo}>{detail.location || ''}</div>
                    </div>
                )}
            </div>
        );
    }

    // Compact icon strip used on the card face when items take the inline
    // slot (either via the "items first" toggle, or because the build has no
    // skills to show). Small sprites with a slot-type abbreviation under
    // each (charm power stars for charms), and the item name on hover.
    const SLOT_ABBR = {
        mainhand: 'MH',
        offhand: 'OH',
        helmet: 'Helm',
        chestplate: 'Chest',
        leggings: 'Legs',
        boots: 'Boots',
    };
    function renderItemStrip() {
        // Charms always start on their own line: the card is just wide
        // enough for seven charm icons (the charm cap), so the whole charm
        // set fits on one wrapped line instead of mixing with equipment.
        const equipment = items.filter((item) => !item.c);
        const charms = items.filter((item) => item.c);
        const renderIcon = (item, i) => {
            const cls = itemSprite(item);
            return (
                <span key={i} className={`${styles.itemStripWrap} ${itemsStyles.enchantTooltip}`}>
                    <span className={styles.itemStripIcon}>
                        {lowRes ? (
                            <span className={styles.stripLowRes} aria-hidden="true" />
                        ) : cls ? (
                            <span className={`${styles.previewSprite} ${cls}`} aria-hidden="true" />
                        ) : null}
                    </span>
                    <span className={styles.itemStripLabel}>
                        {item.c ? '★'.repeat(Math.min(5, Number(item.pw) || 0)) : item.sl && SLOT_ABBR[item.sl]}
                    </span>
                    <span className={itemsStyles.enchantTooltipText}>
                        <span style={{ fontWeight: 600 }}>{item.n}</span>
                        {item.b && item.b !== item.n && (
                            <span style={{ display: 'block', marginTop: 3 }}>{item.b}</span>
                        )}
                    </span>
                </span>
            );
        };
        return (
            <div className={styles.itemStrip}>
                {equipment.map(renderIcon)}
                {charms.length > 0 && <span className={styles.itemStripBreak} aria-hidden="true" />}
                {charms.map(renderIcon)}
            </div>
        );
    }

    // Skill chip. Inline on the card face it shows the two-letter
    // abbreviation with a hover tooltip; the extended side panel passes
    // `full` so the full skill name is displayed instead, and its tooltip is
    // rendered through a portal (the panel clips absolutely-positioned
    // tooltips at its edges).
    function renderSkillChip(s, i, full) {
        return (
            <span
                key={i}
                className={`${styles.skillChip}${full ? ` ${styles.skillChipFull}` : ` ${itemsStyles.enchantTooltip}`}`}
                style={{ color: skillColor(s) }}
                onMouseEnter={
                    full
                        ? (e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTip({ left: rect.left + rect.width / 2, top: rect.top - 6, s });
                          }
                        : undefined
                }
                onMouseLeave={full ? () => setTip(null) : undefined}
            >
                {s.g === 'c' ? (
                    <img
                        className={`${styles.classIcon} ${styles.frameCrop}`}
                        src={czIcon(s)}
                        alt=""
                        width={24}
                        height={24}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : (
                    <img
                        className={styles.classIcon}
                        src={skillIcon(s)}
                        alt=""
                        width={24}
                        height={24}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                )}
                <span className={styles.skillAbbr}>{full ? s.f : s.n}</span>
                {Number(s.p) > 0 && (
                    <span className={styles.skillPoints}>
                        {s.p}
                        {s.e ? '*' : ''}
                    </span>
                )}
                {!full && (
                    <span className={itemsStyles.enchantTooltipText}>
                        <span style={{ fontWeight: 600 }}>{s.f}</span>
                        {(s.g === 'c' ? czDescription(s) : skillInfo(s)?.description) && (
                            <span style={{ display: 'block', marginTop: 3, whiteSpace: 'pre-line' }}>
                                {s.g === 'c' ? czDescription(s) : skillInfo(s).description}
                            </span>
                        )}
                    </span>
                )}
            </span>
        );
    }

    // Layout: default shows the skill chips on the card and the items in the
    // hover panel; the "items first" toggle swaps them. A build with no
    // skills falls back to the item strip so the card isn't empty.
    const showItemStrip = itemsFirst || skills.length === 0;

    return (
        <Link
            ref={cardRef}
            href={base + build.url}
            className={`${styles.card}${expanded ? ` ${styles.cardExpanded}` : ''}`}
            onMouseEnter={onCardEnter}
            onMouseLeave={onCardLeave}
            onClick={onCardClick}
        >
            <div className={styles.cardTop}>
                <div className={styles.cardTitle} title={displayName}>
                    {displayName}
                </div>
                <span className={styles.cardTopBtns}>
                    <button
                        type="button"
                        className={`${styles.favBtn}${build.myFavourite ? ` ${styles.favBtnOn}` : ''}`}
                        onClick={toggleFavourite}
                        aria-label="Toggle favourite"
                    >
                        <span className={itemsStyles.enchantTooltip} style={chipTooltipStyle}>
                            <svg viewBox="0 0 512 512" width="15" height="15" aria-hidden="true">
                                <path
                                    fill={build.myFavourite ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="36"
                                    d="M47.6 300.4 228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96.5 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"
                                />
                            </svg>
                            <span className={styles.favCount}>{build.favouriteCount || 0}</span>
                            <span className={itemsStyles.enchantTooltipText}>
                                {build.myFavourite
                                    ? 'Remove from favourites'
                                    : user
                                      ? 'Add to favourites'
                                      : 'Log in to favourite'}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        className={styles.swapLayoutBtn}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCardLayout();
                        }}
                        aria-label="Swap card layout"
                    >
                        <span className={itemsStyles.enchantTooltip} style={chipTooltipStyle}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
                            </svg>
                            <span className={itemsStyles.enchantTooltipText}>
                                {itemsFirst ? 'Show skills on card' : 'Show items on card'}
                            </span>
                        </span>
                    </button>
                    {onAddCompare && (
                        <button
                            type="button"
                            className={`${styles.compareLayoutBtn}${
                                compareActive ? ` ${styles.compareLayoutBtnOn}` : ''
                            }`}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onAddCompare(build);
                            }}
                            aria-label="Add to comparison"
                            title={compareActive ? 'Remove from comparison' : 'Add to comparison'}
                        >
                            <span className={itemsStyles.enchantTooltip} style={chipTooltipStyle}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M3 5h14v2H3zM3 9h10v2H3zM3 13h14v2H3zM3 17h10v2H3z" />
                                    <path d="M19 6v12h2V6zM17 8h6v2h-6zM17 14h6v2h-6z" opacity="0" />
                                    <path d="M19 5l3 3-3 3V9h-2a1 1 0 0 1 0-2h2V5zM19 19v-2h-2a1 1 0 0 1 0-2h2v-2l3 3-3 3z" />
                                </svg>
                                <span className={itemsStyles.enchantTooltipText}>
                                    {compareActive ? 'Remove from comparison' : 'Add to comparison'}
                                </span>
                            </span>
                        </button>
                    )}
                </span>
            </div>

            <div className={styles.cardTags}>
                {build.class && (
                    <span className={styles.classTag} style={{ color: 'var(--accent, #9C59D1)' }}>
                        <span className={itemsStyles.enchantTooltip} style={chipTooltipStyle}>
                            <img
                                className={styles.classIcon}
                                src={`${base}/images/classes/${build.class.toLowerCase()}.png`}
                                alt=""
                                width={24}
                                height={24}
                            />
                            {build.class}
                            {classInfo && (
                                <span className={itemsStyles.enchantTooltipText}>
                                    <span style={{ fontWeight: 600 }}>{build.class}</span>
                                    {classInfo && (
                                        <span style={{ display: 'block', marginTop: 3, whiteSpace: 'pre-line' }}>
                                            {classInfo}
                                        </span>
                                    )}
                                </span>
                            )}
                        </span>
                        {build.spec && (
                            <>
                                <span className={styles.tagSep}>·</span>
                                <span className={itemsStyles.enchantTooltip} style={chipTooltipStyle}>
                                    <img
                                        className={styles.classIcon}
                                        src={`${base}/images/classes/${build.spec.toLowerCase()}.png`}
                                        alt=""
                                        width={24}
                                        height={24}
                                    />
                                    {build.spec}
                                    {specInfo && (
                                        <span className={itemsStyles.enchantTooltipText}>
                                            <span style={{ fontWeight: 600 }}>{build.spec}</span>
                                            {specInfo && (
                                                <span
                                                    style={{ display: 'block', marginTop: 3, whiteSpace: 'pre-line' }}
                                                >
                                                    {specInfo}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </>
                        )}
                    </span>
                )}
                {!build.class && build.spec && (
                    <span className={`${styles.tag} ${itemsStyles.enchantTooltip}`} style={chipTooltipStyle}>
                        {build.spec}
                        {specInfo && (
                            <span className={itemsStyles.enchantTooltipText}>
                                <span style={{ fontWeight: 600 }}>{build.spec}</span>
                                <span style={{ display: 'block', marginTop: 3, whiteSpace: 'pre-line' }}>
                                    {specInfo}
                                </span>
                            </span>
                        )}
                    </span>
                )}
                {build.region && <span className={styles.tag}>{build.region}</span>}
                {build.tree && (
                    <span className={styles.classTag}>
                        <img
                            className={styles.classIcon}
                            src={treeIcon(build.tree)}
                            alt=""
                            width={26}
                            height={26}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                        {build.tree}
                    </span>
                )}
            </div>

            {!itemsFirst && skills.length > 0 && (
                <div className={styles.skillsRow}>{skills.map((s, i) => renderSkillChip(s, i))}</div>
            )}

            {showItemStrip && items.length > 0 && renderItemStrip()}

            <div className={styles.cardMeta}>
                {build.ascension > 0 && <span className={styles.metaItem}>Ascension {build.ascension}</span>}
            </div>

            <div className={styles.cardBottom}>
                <span className={styles.author} title={build.authorName || 'Anonymous'}>
                    {avatar && <img className={styles.avatar} src={avatar} alt="" width={18} height={18} />}
                    {build.authorName || <TranslatableText identifier="database.anonymous" />}
                </span>
                <span className={styles.date}>
                    {new Date((build.updatedAt || build.createdAt) + 'Z').toLocaleDateString()}
                </span>
            </div>

            {children}

            {isTouch && expanded && (itemsFirst ? skills.length > 0 : items.length > 0) && (
                <div className={styles.mobileItems}>
                    {(itemsFirst ? skills : items).map(
                        itemsFirst ? (s, i) => renderSkillChip(s, i, true) : renderItemRow
                    )}
                </div>
            )}

            {!isTouch && expanded && (itemsFirst ? skills.length > 0 : items.length > 0) && (
                <div
                    className={`${styles.cardSide} ${side === 'left' ? styles.cardSideLeft : styles.cardSideRight}${sideOpen ? ` ${styles.cardSideOpen}` : ''}`}
                >
                    {(itemsFirst ? skills : items).map(
                        itemsFirst ? (s, i) => renderSkillChip(s, i, true) : renderItemRow
                    )}
                </div>
            )}

            {tip &&
                createPortal(
                    <div className={styles.cardTip} style={{ left: tip.left, top: tip.top }}>
                        <span style={{ fontWeight: 600 }}>{tip.s.f}</span>
                        {(tip.s.g === 'c' ? czDescription(tip.s) : skillInfo(tip.s)?.description) && (
                            <span style={{ display: 'block', marginTop: 3, whiteSpace: 'pre-line' }}>
                                {tip.s.g === 'c' ? czDescription(tip.s) : skillInfo(tip.s).description}
                            </span>
                        )}
                    </div>,
                    document.body
                )}
        </Link>
    );
}
