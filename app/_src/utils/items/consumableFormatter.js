import styles from '../../styles/Items.module.css';

const nameMappings = {
    'Vanilla Fire Res': 'Fire Immunity',
    damage: 'Damage',
};

const oneLevelEffects = ['Fire Immunity', 'Night Vision', 'Nausea'];
const integerLevelEffects = ['Regeneration', 'Haste', 'Mining Fatigue', 'Poison', 'Jump Boost'];
// Positive-strength effects that are still debuffs; used only when the API did
// not provide a per-line color (missed extraction, custom items).
const inverseColorEffects = [
    'Slow',
    'Vulnerability',
    'Fire Vulnerability',
    'Blast Vulnerability',
    'Magic Vulnerability',
    'Melee Vulnerability',
    'Fall Vulnerability',
    'Projectile Vulnerability',
    'Instant Damage',
    'Anti Heal',
    'Melee Weakness',
    'Projectile Weakness',
    'Magic Weakness',
    'Weakness',
    'Mining Fatigue',
    'Poison',
    'Nausea',
    'Blindness',
    'Wither',
    'Hunger',
    'Bad Luck',
    'Clucking',
    'Ability Cooldown',
    'Durability Loss',
    'Exp Loss',
    'Max Health Decrease',
    'Negative Attack Speed',
    'Negative Knockback Resistance',
    'Soul Thread Reduction',
];

class ConsumableFormatter {
    static convertTime(ticks) {
        let seconds = (ticks / 20) % 60;
        let minutes = Math.floor(ticks / (20 * 60));
        return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
    }

    // The effect's display name ("AbilityCooldownIncrease" -> "Ability
    // Cooldown"), without mutating the effect object - the item data is shared
    // between tiles and renders.
    static effectName(effect) {
        let splitName = effect.EffectType.split(/(?=[A-Z])/).join(' ');
        splitName = splitName
            .replace('Percent', '')
            .replace('Increase', '')
            .replace(/Resist$/, 'Resistance')
            .trim();

        // Some effects have a completely different name.
        const mapping = nameMappings[splitName];
        if (mapping !== undefined) {
            splitName = mapping;
        }
        return splitName;
    }

    static toHumanReadable(effect) {
        const splitName = this.effectName(effect);

        // Some effects use levels like III instead of percentages, for the effect potency.
        if (integerLevelEffects.includes(splitName)) {
            return `${splitName} ${effect.EffectStrength}`;
        }

        if (oneLevelEffects.includes(splitName)) {
            return splitName;
        }
        return `${effect.EffectStrength < 0 ? '-' : '+'}${(effect.EffectStrength * 100).toPrecision(2)}% ${splitName}`;
    }

    static statStyle(effect) {
        return (effect.EffectStrength < 0) ^ inverseColorEffects.includes(this.effectName(effect))
            ? 'negativeCharm'
            : 'positiveCharm';
    }

    static shouldTimeBeVisible(effectType) {
        return !effectType.toLowerCase().includes('instant');
    }

    static formatEffects(consumableEffects, effectColors) {
        let formattedEffects = [];

        for (const [index, effect] of consumableEffects.entries()) {
            // The game's own loot line color wins; the sign/inverse heuristic
            // below is only the fallback for items without extracted colors.
            const color = effectColors && effectColors[index];
            formattedEffects.push(
                <span
                    className={color ? undefined : styles[this.statStyle(effect)]}
                    style={color ? { color } : undefined}
                    key={`${effect.EffectType}-${index}`}
                >
                    {this.toHumanReadable(effect)}{' '}
                    {this.shouldTimeBeVisible(effect.EffectType) ? (
                        <span className={styles.infoText}>{`(${this.convertTime(effect.EffectDuration)})`}</span>
                    ) : (
                        ''
                    )}
                </span>
            );
        }

        return formattedEffects;
    }
}

export default ConsumableFormatter;
