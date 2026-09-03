'use client';

import React from 'react';
import styles from '../styles/Compare.module.css';
import TranslatableText from './translatableText';
import Stats from '../utils/builder/stats';
import CharmShortener from '../utils/builder/charmShortener';
import { computeCharmTotals } from './builder/charmSelector';
import { decodeBuildParam } from '../utils/builder/buildUrlCodec';

// Stat categories, matching the builder's stat cards (buildForm.js) and the
// categories of Monumenta's Player Stats calculator. Values are read from the
// same Stats engine instance the builder uses, so the numbers match the
// builder exactly.
const categoryDefs = [
    {
        key: 'misc',
        title: 'Misc',
        rows: [
            { type: 'armor', name: 'builder.stats.misc.armor', percent: false },
            { type: 'agility', name: 'builder.stats.misc.agility', percent: false },
            { type: 'speedPercent', name: 'builder.stats.misc.speed', percent: true },
            { type: 'knockbackRes', name: 'builder.stats.misc.kbResistance', percent: true },
            { type: 'thorns', name: 'builder.stats.misc.thorns', percent: false },
            { type: 'fireTickDamage', name: 'builder.stats.misc.fireTickDamage', percent: false },
            { type: 'spellCooldownPercent', name: 'builder.stats.magic.spellCooldownPercent', percent: true },
        ],
    },
    {
        key: 'health',
        title: 'Health and Healing',
        rows: [
            { type: 'healthFinal', name: 'builder.stats.health.healthFinal', percent: false },
            { type: 'currentHealth', name: 'builder.stats.health.currentHealth', percent: false },
            { type: 'healingRate', name: 'builder.stats.health.healingRate', percent: true },
            { type: 'effHealingRate', name: 'builder.stats.health.effectiveHealingRate', percent: true },
            { type: 'regenPerSec', name: 'builder.stats.health.regenPerSecond', percent: false },
            { type: 'regenPerSecPercent', name: 'builder.stats.health.regenPerSecondPercent', percent: true },
            { type: 'lifeDrainOnCrit', name: 'builder.stats.health.lifeDrainOnCrit', percent: false },
            { type: 'lifeDrainOnCritPercent', name: 'builder.stats.health.lifeDrainOnCritPercent', percent: true },
        ],
    },
    {
        key: 'dr',
        title: 'Damage Reduction',
        rows: [
            { type: 'meleeDR', name: 'builder.stats.dr-ehp.melee', percent: true },
            { type: 'projectileDR', name: 'builder.stats.dr-ehp.projectile', percent: true },
            { type: 'magicDR', name: 'builder.stats.dr-ehp.magic', percent: true },
            { type: 'blastDR', name: 'builder.stats.dr-ehp.blast', percent: true },
            { type: 'fireDR', name: 'builder.stats.dr-ehp.fire', percent: true },
            { type: 'fallDR', name: 'builder.stats.dr-ehp.fall', percent: true },
            { type: 'ailmentDR', name: 'builder.stats.dr-ehp.ailment', percent: true },
        ],
    },
    {
        key: 'drhn',
        title: 'Health Normalized Damage Reduction',
        rows: [
            { type: 'meleeHNDR', name: 'builder.stats.dr-ehp.melee', percent: true },
            { type: 'projectileHNDR', name: 'builder.stats.dr-ehp.projectile', percent: true },
            { type: 'magicHNDR', name: 'builder.stats.dr-ehp.magic', percent: true },
            { type: 'blastHNDR', name: 'builder.stats.dr-ehp.blast', percent: true },
            { type: 'fireHNDR', name: 'builder.stats.dr-ehp.fire', percent: true },
            { type: 'fallHNDR', name: 'builder.stats.dr-ehp.fall', percent: true },
            { type: 'ailmentHNDR', name: 'builder.stats.dr-ehp.ailment', percent: true },
        ],
    },
    {
        key: 'ehp',
        title: 'Effective Health',
        rows: [
            { type: 'meleeEHP', name: 'builder.stats.dr-ehp.melee', percent: false },
            { type: 'projectileEHP', name: 'builder.stats.dr-ehp.projectile', percent: false },
            { type: 'magicEHP', name: 'builder.stats.dr-ehp.magic', percent: false },
            { type: 'blastEHP', name: 'builder.stats.dr-ehp.blast', percent: false },
            { type: 'fireEHP', name: 'builder.stats.dr-ehp.fire', percent: false },
            { type: 'fallEHP', name: 'builder.stats.dr-ehp.fall', percent: false },
            { type: 'ailmentEHP', name: 'builder.stats.dr-ehp.ailment', percent: false },
        ],
    },
    {
        key: 'melee',
        title: 'Melee',
        rows: [
            { type: 'attackSpeedPercent', name: 'builder.stats.melee.attackSpeedPercent', percent: true },
            { type: 'attackSpeed', name: 'builder.stats.melee.attackSpeed', percent: false },
            { type: 'attackDamagePercent', name: 'builder.stats.melee.attackDamagePercent', percent: true },
            { type: 'classAttackDamagePercent', name: 'builder.stats.melee.classAttackDamagePercent', percent: true },
            { type: 'attackDamage', name: 'builder.stats.melee.attackDamage', percent: false },
            { type: 'attackDamageCrit', name: 'builder.stats.melee.attackDamageCrit', percent: false },
            { type: 'iframeDPS', name: 'builder.stats.melee.iframeDps', percent: false },
            { type: 'iframeCritDPS', name: 'builder.stats.melee.iframeCritDps', percent: false },
            { type: 'critSpamDPS', name: 'builder.stats.melee.critSpamDPS', percent: false },
        ],
        hideClassDefault: 'classAttackDamagePercent',
    },
    {
        key: 'projectile',
        title: 'Projectile',
        rows: [
            {
                type: 'projectileDamagePercent',
                name: 'builder.stats.projectile.projectileDamagePercent',
                percent: true,
            },
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
        ],
        hideClassDefault: 'classProjectileDamagePercent',
    },
    {
        key: 'magic',
        title: 'Magic',
        rows: [
            { type: 'magicDamagePercent', name: 'builder.stats.magic.magicDamagePercent', percent: true },
            { type: 'classMagicDamagePercent', name: 'builder.stats.magic.classMagicDamagePercent', percent: true },
            { type: 'spellDamage', name: 'builder.stats.magic.spellDamage', percent: true },
            { type: 'potionDamage', name: 'builder.stats.magic.potionDamage', percent: false },
        ],
    },
];

const SLOTS = [
    { field: 'mainhand', letter: 'm', label: 'Mainhand' },
    { field: 'offhand', letter: 'o', label: 'Offhand' },
    { field: 'helmet', letter: 'h', label: 'Helmet' },
    { field: 'chestplate', letter: 'c', label: 'Chestplate' },
    { field: 'leggings', letter: 'l', label: 'Leggings' },
    { field: 'boots', letter: 'b', label: 'Boots' },
];

const skillBuffKeys = {
    Celestial: 'celestial_blessing',
    WeaponMastery: 'weapon_mastery',
    Toughness: 'toughness',
};
const specSkillBuffKeys = {
    Taboo: 'taboo',
};
const DEFAULT_BUFF_FLAGS = {
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
};

function parseLegacyParts(decoded) {
    try {
        return decodeURI(decoded).split('&');
    } catch (e) {
        return [];
    }
}

function partValue(parts, letter) {
    return (
        parts
            .find((str) => str.startsWith(`${letter}=`))
            ?.split('=')
            .slice(1)
            .join('=') || null
    );
}

function titleCase(str) {
    return String(str || '').replace(/^\w/, (c) => c.toUpperCase());
}

function plainName(key) {
    return String(key || '').replace(/-\d+$/, '');
}

function buildBuffFlags(parts, gameClass) {
    const flags = { ...DEFAULT_BUFF_FLAGS };
    const pointsOf = (field) => {
        const out = {};
        const raw = partValue(parts, field);
        if (raw) {
            for (const part of raw.split(',')) {
                const [id, pts] = part.split(':');
                const n = Number(pts);
                if (id && Number.isInteger(n) && n > 0) out[id] = n;
            }
        }
        return out;
    };
    const sk = pointsOf('sk');
    const ssk = pointsOf('ssk');
    const en = new Set((partValue(parts, 'en') || '').split(',').filter(Boolean));
    if (gameClass) {
        for (const [id, pts] of Object.entries(sk)) {
            const buffKey = skillBuffKeys[id];
            if (!buffKey) continue;
            flags[buffKey] = pts >= 1;
            flags[`${buffKey}_lv1`] = pts >= 1;
            flags[`${buffKey}_lv2`] = pts >= 2;
            if (en.has(id) && pts >= 1) flags[`${buffKey}_enhancement`] = true;
        }
        for (const [id, pts] of Object.entries(ssk)) {
            const buffKey = specSkillBuffKeys[id];
            if (!buffKey) continue;
            flags[`${buffKey}_lv1`] = pts >= 1;
            flags[`${buffKey}_lv2`] = pts >= 2;
            flags[`${buffKey}_burst`] = pts >= 3;
        }
    }
    return flags;
}

function parseBuild(build, itemData) {
    const decoded = decodeBuildParam(build, itemData);
    if (!decoded) return null;
    const parts = parseLegacyParts(decoded);
    const items = [];
    for (const { field, letter, label } of SLOTS) {
        const value = partValue(parts, letter);
        if (!value || value === 'None' || !Object.prototype.hasOwnProperty.call(itemData, value)) continue;
        items.push({ slot: label, name: plainName(itemData[value].name) });
    }
    const charms = [];
    const charmRaw = partValue(parts, 'charm');
    if (charmRaw && charmRaw !== 'None') {
        let powerCount = 0;
        for (const name of CharmShortener.parseCharmData(decodeURIComponent(charmRaw), itemData)) {
            const info = itemData[name];
            if (!info) continue;
            if (powerCount + (info.power || 0) > 12) break;
            powerCount += info.power || 0;
            charms.push({ name: info.name, power: info.power, class: info.class_name });
        }
    }

    let engine = null;
    try {
        engine = new Stats(
            itemData,
            buildFormFromParts(parts, itemData),
            {},
            {},
            buildBuffFlags(parts, gameClassFrom(parts))
        );
    } catch (e) {
        engine = null;
    }

    const classPart = partValue(parts, 'cl');
    const specPart = partValue(parts, 'sp');

    // Aggregated charm stats (the totals over every equipped charm), parsed
    // into numeric rows so they join the comparison like any other stat.
    let charmStats = [];
    if (charms.length > 0) {
        const totals = computeCharmTotals(
            itemData,
            charms.map((c) => c.name)
        );
        charmStats = Object.entries(totals).map(([stat, obj]) => {
            const rawLabel = stat
                .split('_')
                .filter((part) => part != 'm' && part != 'p' && part != 'bow' && part != 'tool')
                .map((part) => part[0].toUpperCase() + part.substring(1))
                .join(' ');
            return {
                key: stat,
                label: rawLabel.replace(' Percent', '').replace(' Base', '').replace(' Flat', ''),
                percent: rawLabel.includes(' Percent'),
                signed: true,
                value: Number(obj.value) || 0,
                locked: Boolean(obj.locked),
            };
        });
    }

    const categoryRows = {};
    for (const cat of categoryDefs) {
        const rows = [];
        for (const def of cat.rows) {
            if (cat.hideClassDefault && engine && Number(engine[cat.hideClassDefault]) === 100) {
                if (def.type === cat.hideClassDefault) continue;
            }
            const value = engine ? engine[def.type] : undefined;
            if (value === undefined || value === null || value === '') continue;
            if (cat.key === 'magic') {
                // Only one of the two weapon types applies (spell for wands,
                // potion for alch bags) - mirror the builder's display rules.
                if (def.type === 'potionDamage' && String(engine.spellPowerPercent) !== '100.00') continue;
                if (def.type === 'spellDamage' && String(engine.potionDamage) !== '0.00') continue;
            }
            rows.push({ labelKey: def.name, value: Number(value), percent: def.percent });
        }
        if (cat.key === 'ehp' && engine && engine.instability) {
            const unstableEHPTypes = ['meleeEHP', 'projectileEHP', 'magicEHP', 'blastEHP'];
            let avg = 0;
            unstableEHPTypes.forEach((t) => (avg += Number(engine[t])));
            avg /= 4;
            rows.unshift({ labelKey: 'builder.stats.dr-ehp.unstable', value: avg, percent: false });
        }
        categoryRows[cat.key] = rows;
    }

    return {
        items,
        charms,
        className: classPart && classPart !== 'none' ? titleCase(classPart) : null,
        specName: specPart || null,
        charmStats,
        categories: categoryDefs.map((cat) => ({ key: cat.key, title: cat.title, rows: categoryRows[cat.key] })),
    };
}

// Copy of the form builder used inside parseBuild (kept out of the hot path
// for readability above).
function buildFormFromParts(parts, itemData) {
    const form = {
        mainhand: 'None',
        offhand: 'None',
        helmet: 'None',
        chestplate: 'None',
        leggings: 'None',
        boots: 'None',
        tenacity: 0,
        vitality: 0,
        vigor: 0,
        focus: 0,
        perspicacity: 0,
    };
    for (const { field, letter } of SLOTS) {
        const value = partValue(parts, letter);
        if (value && Object.prototype.hasOwnProperty.call(itemData, value)) form[field] = value;
    }
    for (const key of ['health', 'tenacity', 'vitality', 'vigor', 'focus', 'perspicacity', 'region']) {
        const raw = partValue(parts, key);
        const n = Number(raw);
        if (raw !== null && Number.isFinite(n)) form[key] = n;
        else if (key === 'health') form[key] = 100;
        else if (key === 'region') form[key] = 3;
        else form[key] = 0;
    }
    if (![1, 2, 3].includes(Number(form.region))) form.region = 3;
    return form;
}

function gameClassFrom(parts) {
    const classPart = partValue(parts, 'cl');
    return classPart && classPart !== 'none' ? classPart.toLowerCase() : null;
}

// Strip a full URL / ?build= wrapper down to the raw token when possible
// (mirrors the builder import bar), or keep the raw string for the
// /api/v1/builds/convert endpoint (which also understands saved /b/ links).
async function resolveInput(raw, itemData) {
    let link = String(raw || '').trim();
    if (!link) return { error: 'Enter a build link first.' };

    // Bare token or legacy query -> decode directly with the page's data.
    let candidate = link;
    try {
        if (link.includes('?build=')) {
            const qIdx = link.indexOf('?');
            const paramStr = link.slice(qIdx + 1);
            const params = new URLSearchParams(paramStr);
            candidate = params.get('build') || '';
            if (!(candidate.includes('=') && candidate.includes('&')) && paramStr.includes('=')) {
                candidate = paramStr.replace(/^build=/, '');
            }
        } else if (/^https?:\/\//i.test(link)) {
            const idx = link.lastIndexOf('/builder');
            if (idx !== -1) {
                candidate = link.slice(idx + '/builder'.length).replace(/^[/?]/, '');
                const qIdx = candidate.indexOf('?');
                if (qIdx !== -1) candidate = candidate.slice(0, qIdx);
                const fIdx = candidate.indexOf('#');
                if (fIdx !== -1) candidate = candidate.slice(0, fIdx);
            } else if (/\/b(?:\/v\d+)?\//.test(link)) {
                candidate = null; // saved short link -> endpoint
            } else {
                candidate = null;
            }
        }
        if (
            candidate &&
            (candidate.startsWith('v1_') ||
                candidate.startsWith('z:') ||
                (candidate.includes('=') && candidate.includes('&')))
        ) {
            candidate = decodeURIComponent(candidate.trim());
            const parsed = parseBuild(candidate, itemData);
            if (parsed) return { token: candidate, parsed };
            candidate = null;
        }
    } catch (e) {
        candidate = null;
    }

    // Everything else (saved /b/ links, a bare database id, unknown
    // wrappers) goes through the site's convert endpoint, which resolves it
    // with the same codec. A lone database id is tried as /b/<id>.
    try {
        const asShort =
            !link.startsWith('v1_') &&
            !link.startsWith('z:') &&
            !link.includes('=') &&
            !link.includes('/') &&
            /^[A-Za-z0-9_-]{4,40}$/.test(link)
                ? '/b/' + link
                : link;
        const res = await fetch('/api/v1/builds/convert?link=' + encodeURIComponent(asShort));
        const data = await res.json();
        if (!res.ok || !data.token) return { error: data.error || 'Could not read that build link.' };
        const parsed = parseBuild(data.token, itemData);
        if (!parsed) return { error: 'Could not read that build.' };
        return { token: data.token, parsed };
    } catch (e) {
        return { error: 'Could not reach the build service.' };
    }
}

export default function ComparePage({ itemData }) {
    const [left, setLeft] = React.useState(null); // { token, parsed, error }
    const [right, setRight] = React.useState(null);
    const [leftInput, setLeftInput] = React.useState('');
    const [rightInput, setRightInput] = React.useState('');
    const [loadingSide, setLoadingSide] = React.useState(null);
    const autoLoaded = React.useRef(false);

    // Live database suggestions under each input bar.
    const [suggestions, setSuggestions] = React.useState({ left: null, right: null });
    const [suggestOpen, setSuggestOpen] = React.useState({ left: false, right: false });
    const suggestTimer = React.useRef(null);

    async function loadSide(side, explicitRaw) {
        const raw = explicitRaw !== undefined ? explicitRaw : side === 'left' ? leftInput : rightInput;
        setLoadingSide(side);
        setSuggestOpen((p) => ({ ...p, [side]: false }));
        const setter = side === 'left' ? setLeft : setRight;
        const result = await resolveInput(raw, itemData);
        if (result.error) setter({ error: result.error });
        else setter({ token: result.token, parsed: result.parsed });
        setLoadingSide(null);
    }

    function pickSuggestion(side, build) {
        const value = build.url;
        if (side === 'left') setLeftInput(value);
        else setRightInput(value);
        loadSide(side, value);
    }

    // Debounced suggestion search per side (the public database search API).
    function refreshSuggestions(side, value) {
        const query = String(value || '').trim();
        if (!query) {
            setSuggestions((p) => ({ ...p, [side]: null }));
            setSuggestOpen((p) => ({ ...p, [side]: false }));
            return;
        }
        if (suggestTimer.current) clearTimeout(suggestTimer.current);
        suggestTimer.current = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q: query, page: '1', limit: '6', sort: 'top' });
                const res = await fetch(`/api/v1/builds/public?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) throw new Error();
                setSuggestions((p) => ({ ...p, [side]: data.builds || [] }));
                setSuggestOpen((p) => ({ ...p, [side]: true }));
            } catch (e) {
                setSuggestions((p) => ({ ...p, [side]: [] }));
                setSuggestOpen((p) => ({ ...p, [side]: false }));
            }
        }, 300);
    }

    // A pasted link/token/short id loads immediately (no Enter needed);
    // anything else just opens the suggestion list.
    function onPasteSide(side, e) {
        const text = (e.clipboardData.getData('text') || '').trim();
        const looksCommittable =
            text &&
            (text.includes('/') ||
                text.includes('=') ||
                text.startsWith('v1_') ||
                text.startsWith('z:') ||
                /^[A-Za-z0-9_-]{4,40}$/.test(text));
        if (looksCommittable) {
            // Read the field value directly: the paste's input event may not
            // have flushed to React state yet by the time we load.
            const el = e.currentTarget;
            setTimeout(() => loadSide(side, el.value), 0);
        }
    }

    function changeInput(side, value) {
        if (side === 'left') setLeftInput(value);
        else setRightInput(value);
        refreshSuggestions(side, value);
    }

    function blurSuggestions(side) {
        // Delay so a suggestion click registers before the list closes.
        setTimeout(() => setSuggestOpen((p) => ({ ...p, [side]: false })), 150);
    }

    // /compare?left=<url>&right=<url> (used by the database page's "add to
    // comparison" buttons) auto-fills and loads both sides on mount.
    React.useEffect(() => {
        if (autoLoaded.current || typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const a = params.get('left');
        const b = params.get('right');
        if (a) setLeftInput(a);
        if (b) setRightInput(b);
        autoLoaded.current = true;
        if (a) loadSide('left', a);
        if (b) loadSide('right', b);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showCompare = left && !left.error && left.parsed && right && !right.error && right.parsed;

    return (
        <div className={styles.container}>
            <h1 className={styles.pageTitle}>Build Comparison</h1>

            <div className={styles.pickers}>
                {['left', 'right'].map((side) => {
                    const state = side === 'left' ? left : right;
                    const list = suggestions[side];
                    const open = suggestOpen[side];
                    return (
                        <div key={side} className={styles.picker}>
                            <span className={styles.pickerTitle}>{side === 'left' ? 'Build A' : 'Build B'}</span>
                            <div className={styles.pickerRow}>
                                <div className={styles.pickerInputWrap}>
                                    <input
                                        type="text"
                                        className={styles.pickerInput}
                                        placeholder={
                                            side === 'left'
                                                ? 'Search builds, or paste a link / id'
                                                : 'Second build: search, link or id'
                                        }
                                        value={side === 'left' ? leftInput : rightInput}
                                        onChange={(e) => changeInput(side, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                loadSide(side);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (suggestions[side] && suggestions[side].length > 0) {
                                                setSuggestOpen((p) => ({ ...p, [side]: true }));
                                            }
                                        }}
                                        onBlur={() => blurSuggestions(side)}
                                        onPaste={(e) => onPasteSide(side, e)}
                                        spellCheck="false"
                                    />
                                    {open && list && list.length > 0 && (
                                        <div className={styles.pickerSuggestions}>
                                            {list.map((build) => {
                                                const display =
                                                    build.name ||
                                                    [build.class, build.spec].filter(Boolean).join(' · ') ||
                                                    `Build ${build.id}`;
                                                const meta = [build.class, build.spec].filter(Boolean).join(' · ');
                                                return (
                                                    <button
                                                        key={build.id}
                                                        type="button"
                                                        className={styles.suggestionRow}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            pickSuggestion(side, build);
                                                        }}
                                                    >
                                                        <span className={styles.suggestionName}>{display}</span>
                                                        <span className={styles.suggestionMeta}>
                                                            {meta}
                                                            {build.power ? ` · Power ${build.power}` : ''}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className={styles.pickerButton}
                                    onClick={() => loadSide(side)}
                                    disabled={loadingSide === side}
                                >
                                    {loadingSide === side ? 'Loading...' : 'Load'}
                                </button>
                            </div>
                            {state && state.error ? (
                                <div className={styles.pickerError}>{state.error}</div>
                            ) : state && state.parsed ? (
                                <div className={styles.pickerOk}>
                                    {[state.parsed.className, state.parsed.specName].filter(Boolean).join(' · ') ||
                                        'Build loaded'}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            {showCompare ? (
                <CompareTable left={left.parsed} right={right.parsed} />
            ) : (
                <p className={styles.hint}>Load two builds to compare their stats, items and charms side by side.</p>
            )}
        </div>
    );
}

function CompareTable({ left, right }) {
    const meta = (b) => [b.className, b.specName].filter(Boolean).join(' · ') || 'Untitled build';

    const allCategories = left.categories.map((cat, i) => ({
        ...cat,
        rightCat: right.categories[i],
    }));

    return (
        <>
            <div className={styles.sidesRow}>
                <div className={styles.sidePanel}>
                    <div className={styles.sideTitle}>{meta(left)}</div>
                    {renderEquipment(left)}
                </div>
                <div className={styles.sidePanel}>
                    <div className={styles.sideTitle}>{meta(right)}</div>
                    {renderEquipment(right)}
                </div>
            </div>

            {allCategories.map((cat) => {
                const rowsByKey = new Map();
                for (const row of cat.rows) rowsByKey.set(row.labelKey, { left: row });
                for (const row of cat.rightCat.rows) {
                    const existing = rowsByKey.get(row.labelKey);
                    if (existing) existing.right = row;
                    else rowsByKey.set(row.labelKey, { right: row });
                }
                if (rowsByKey.size === 0) return null;
                return (
                    <section key={cat.key} className={styles.category}>
                        <h2 className={styles.categoryTitle}>{cat.title}</h2>
                        {Array.from(rowsByKey.entries()).map(([labelKey, { left: l, right: r }]) => (
                            <CompareRow key={labelKey} labelKey={labelKey} left={l} right={r} />
                        ))}
                    </section>
                );
            })}

            {/* Charm stat totals: the combined effect of each side's charms,
                shown with the same compare rows as the gear stats. */}
            {(() => {
                const rowsByKey = new Map();
                for (const row of left.charmStats || []) rowsByKey.set(row.key, { left: row });
                for (const row of right.charmStats || []) {
                    const existing = rowsByKey.get(row.key);
                    if (existing) existing.right = row;
                    else rowsByKey.set(row.key, { right: row });
                }
                if (rowsByKey.size === 0) return null;
                return (
                    <section className={styles.category}>
                        <h2 className={styles.categoryTitle}>Charm Stats</h2>
                        {Array.from(rowsByKey.entries()).map(([key, { left: l, right: r }]) => {
                            const rowDef = l || r;
                            return (
                                <CompareRow
                                    key={key}
                                    labelText={rowDef.locked ? `🔒 ${rowDef.label}` : rowDef.label}
                                    left={l}
                                    right={r}
                                />
                            );
                        })}
                    </section>
                );
            })()}
        </>
    );
}

function formatValue(row) {
    if (row === undefined || row === null) return null;
    const sign = row.signed && Number(row.value) > 0 ? '+' : '';
    return `${sign}${row.value}${row.percent ? '%' : ''}`;
}

function CompareRow({ labelKey, labelText, left, right }) {
    const lv = left ? Number(left.value) : null;
    const rv = right ? Number(right.value) : null;
    let delta = null;
    if (lv !== null && rv !== null) {
        if (Math.abs(lv - rv) > 1e-9) delta = lv < rv ? 'right' : 'left';
    }

    // Signed relative percentage on BOTH sides: each value shows how far it
    // is from the opposite side's value (e.g. 500 (−9%) | stat | 550 (+10%)).
    const pctText = (mine, other) => {
        if (mine === null || other === null || other === 0 || Math.abs(mine - other) <= 1e-9) return null;
        const relative = (mine - other) / other;
        const sign = relative > 0 ? '+' : '-';
        const cls = relative > 0 ? styles.pctUp : styles.pctDown;
        return (
            <span className={`${styles.rowPct} ${cls}`}>{` (${sign}${(Math.abs(relative) * 100).toFixed(2)}%)`}</span>
        );
    };

    return (
        <div className={styles.compareRow}>
            <span className={styles.rowValue}>
                {formatValue(left) !== null ? (
                    <span className={delta === 'left' ? styles.highlightUp : ''}>
                        {formatValue(left)}
                        {pctText(lv, rv)}
                    </span>
                ) : (
                    <span className={styles.rowNone}>–</span>
                )}
            </span>
            <span className={styles.rowLabel}>
                {labelText !== undefined ? <span>{labelText}</span> : <TranslatableText identifier={labelKey} />}
            </span>
            <span className={styles.rowValue}>
                {formatValue(right) !== null ? (
                    <span className={delta === 'right' ? styles.highlightUp : ''}>
                        {formatValue(right)}
                        {pctText(rv, lv)}
                    </span>
                ) : (
                    <span className={styles.rowNone}>–</span>
                )}
            </span>
        </div>
    );
}

function renderEquipment(build) {
    return (
        <div className={styles.equipList}>
            {build.items.map((it) => (
                <div key={it.slot} className={styles.equipRow}>
                    <span className={styles.equipSlot}>{it.slot}</span>
                    <span className={styles.equipName}>{it.name}</span>
                </div>
            ))}
            {build.charms.map((c) => (
                <div key={c.name} className={styles.equipRow}>
                    <span className={styles.equipSlot}>{'★'.repeat(Math.min(5, c.power || 0))}</span>
                    <span className={styles.equipName}>{c.name}</span>
                    <span className={styles.equipClass}>{c.class}</span>
                </div>
            ))}
            {build.items.length === 0 && build.charms.length === 0 && (
                <span className={styles.rowNone}>Empty build</span>
            )}
        </div>
    );
}
