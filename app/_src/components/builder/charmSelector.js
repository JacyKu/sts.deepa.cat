import styles from '../../styles/CharmSelector.module.css';
import TranslatableText from '../translatableText';
import CharmTile from '../items/charmTile';
import SelectInput from '../items/selectInput';
import React from 'react';

// Human-readable ability text for a charm (stat names + values), so the
// selector search can match abilities, not just names.
function charmAbilityText(item) {
    if (!item?.stats) return '';
    const parts = [];
    for (const [stat, v] of Object.entries(item.stats)) {
        const value = typeof v === 'object' && v !== null ? v.value : v;
        if (value === undefined || value === null) continue;
        const human = stat
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        parts.push(`${Number(value) > 0 ? '+' : ''}${value} ${human}`);
    }
    return parts.join(', ');
}

let abilityCache = null;
function getAbilityTextMap(itemData) {
    if (abilityCache && abilityCache.data === itemData) return abilityCache.map;
    const map = new Map();
    for (const key of Object.keys(itemData)) {
        if (itemData[key].type === 'Charm') map.set(key, charmAbilityText(itemData[key]).toLowerCase());
    }
    abilityCache = { data: itemData, map };
    return map;
}

// The charm list carries display names, but the item data is keyed by
// full item keys (e.g. "Event Horizon (orange_glazed_terracotta)"), which
// differ from the display name for some charms. Resolve either form.
export function resolveCharmKey(itemData, nameOrKey) {
    if (!nameOrKey) return null;
    if (itemData[nameOrKey]) return nameOrKey;
    return (
        Object.keys(itemData).find((key) => itemData[key].type === 'Charm' && itemData[key].name === nameOrKey) || null
    );
}

// Effect summary: totals of every stat across all equipped charms. A stat
// locked by any charm (🔒) is exclusive: only the locked charm's value counts,
// other charms' contributions to that stat are ignored.
export function computeCharmTotals(itemData, charmNames) {
    const totals = {};
    for (const name of charmNames || []) {
        const key = resolveCharmKey(itemData, name);
        const stats = key ? itemData[key].stats : null;
        if (!stats) continue;
        for (const [stat, obj] of Object.entries(stats)) {
            if (!obj || typeof obj.value !== 'number') continue;
            if (obj.locked) {
                totals[stat] = { value: obj.value, locked: true };
            } else if (totals[stat]?.locked) {
                continue;
            } else {
                totals[stat] = { value: (totals[stat]?.value || 0) + obj.value };
            }
        }
    }
    return Object.fromEntries(Object.entries(totals).filter(([, obj]) => obj.value !== 0));
}

// Skill names -> snake tokens ("Hand of Light" -> "hand_of_light"), used to
// match charm stats that name the skill they affect.
function skillTokens(names) {
    const tokens = new Set();
    for (const name of names || []) {
        const snake = String(name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
        if (snake) tokens.add(snake);
    }
    return tokens;
}

export default function CharmSelector({ update, translatableName, itemData, hideList, charmNames, classSkillNames, specSkillNames }) {
    const inputRef = React.useRef();
    const [warn, setWarn] = React.useState(null);
    const warnTimeoutRef = React.useRef();

    // Relevance rule: a charm is offered only if it is a Generalist charm, or
    // one of its stats affects a skill of the selected class or specialization.
    // With no class selected every charm is offered.
    const relevantTokens = skillTokens([...(classSkillNames || []), ...(specSkillNames || [])]);
    const isCharmRelevant = (key) => {
        const charm = itemData[key];
        if (!charm || charm.type !== 'Charm') return false;
        if (relevantTokens.size === 0) return true;
        if (charm.class_name === 'Generalist') return true;
        const stats = charm.stats || {};
        return Object.keys(stats).some((stat) => {
            const s = stat.toLowerCase();
            for (const token of relevantTokens) {
                if (s.includes(token)) return true;
            }
            return false;
        });
    };
    const charmOptions = Object.keys(itemData).filter((key) => itemData[key].type === 'Charm' && isCharmRelevant(key));

    const maxPower = 12;
    const entries = charmNames || [];
    const usedPower = entries.reduce((sum, name) => {
        const key = resolveCharmKey(itemData, name);
        return sum + (key ? itemData[key].power || 0 : 0);
    }, 0);

    const abilityTextMap = getAbilityTextMap(itemData);
    const charmFilterOption = (option, input) => {
        const query = input.toLowerCase();
        if (option.label.toLowerCase().includes(query)) return true;
        const ability = abilityTextMap.get(option.value);
        return Boolean(ability && ability.includes(query));
    };

    function showWarn(message) {
        setWarn(message);
        if (warnTimeoutRef.current) clearTimeout(warnTimeoutRef.current);
        warnTimeoutRef.current = setTimeout(() => setWarn(null), 5000);
    }

    function processUpdate(updatedEntries) {
        setWarn(null);
        update(updatedEntries);
    }

    function addEntry() {
        let input = inputRef.current.getValue()[0].value;

        let actualName = Object.keys(itemData).find((name) => name.toLowerCase() == input.toLowerCase());

        if (!actualName || itemData[actualName].type != 'Charm') return;
        if (!isCharmRelevant(actualName)) return;
        if (entries.some((name) => resolveCharmKey(itemData, name) === actualName)) return;
        if (usedPower + (itemData[actualName].power || 0) > maxPower) return;

        // Locked charm stats (🔒) are exclusive: a charm that locks a stat
        // can't be combined with any other charm that carries that stat, in
        // either direction. Block the add and explain why.
        const newStats = itemData[actualName].stats || {};
        const equipped = new Map(); // stat -> { name, locked }
        entries.forEach((name) => {
            const key = resolveCharmKey(itemData, name);
            const stats = key ? itemData[key]?.stats : null;
            if (!stats) return;
            for (const [stat, obj] of Object.entries(stats)) {
                if (obj && typeof obj.value === 'number') equipped.set(stat, { name: itemData[key].name, locked: Boolean(obj.locked) });
            }
        });
        for (const [stat, obj] of Object.entries(newStats)) {
            if (!obj || typeof obj.value !== 'number') continue;
            const other = equipped.get(stat);
            if (!other) continue;
            if (other.locked || obj.locked) {
                showWarn(
                    `"${itemData[actualName].name}" could not be added: it conflicts with the locked charm stat from "${other.name}" (${stat.replace(/_/g, ' ')}).`
                );
                return;
            }
        }

        processUpdate([...entries, actualName]);
    }

    return (
        <div className={`${styles.listSelectorContainer} p-1`}>
            <p className={`${styles.name} m-0 mb-1`}>
                <TranslatableText identifier={translatableName}></TranslatableText>
            </p>
            <div className={`${styles.listSelectorInputs} justify-content-center`}>
                <span className={`${styles.entryInput} me-1`}>
                    <SelectInput
                        reference={inputRef}
                        name="charm"
                        noneOption={true}
                        sortableStats={charmOptions}
                        filterOption={charmFilterOption}
                    ></SelectInput>
                </span>
                <button className={styles.button} onClick={addEntry}>
                    +
                </button>
            </div>
            <div className={`${styles.powerStars} justify-content-center`}>
                <span>{`${usedPower}/${maxPower} [`}</span>
                <span className={styles.activeStars}>{'★'.repeat(usedPower)}</span>
                <span>{`${'☆'.repeat(maxPower - usedPower)}]`}</span>
            </div>
            {warn && (
                <div className={`${styles.charmLockedWarn} mt-1`} role="alert">
                    {warn}
                </div>
            )}
            {!hideList && (
                <div className={styles.listSelectorList}>
                    {entries.map((entry, index) => {
                        const entryKey = resolveCharmKey(itemData, entry);
                        if (!entryKey) return null;
                        return (
                            <span
                                key={index}
                                className={styles.entry}
                                onClick={() => processUpdate(entries.filter((_, i) => i != index))}
                            >
                                <CharmTile
                                    key={entryKey}
                                    name={itemData[entryKey].name}
                                    item={itemData[entryKey]}
                                ></CharmTile>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
