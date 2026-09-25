import styles from '../../styles/Items.module.css';

// Charm stats Monumenta renders in pink (#ff9cf0) instead of the standard
// positive cyan - read from the items' in-game MMCharmText. Per-stat, so a
// pink-keyed line stays pink on every charm/masterwork that carries it.
const PINK_CHARM_STATS = new Set([
    'totemic_consecration_strength_amplifier_percent',
    'totemic_consecration_speed_amplifier_percent',
    'wind_walk_vulnerability_amplifier_percent',
    'wind_walk_vulnerability_duration_flat',
    'wind_bomb_explosions_flat',
    'dark_pact_deactivation_damage_radius_flat',
    'dark_pact_damage_per_absorption_on_deactivation_flat',
    'unstable_amalgam_health_flat',
    'unstable_amalgam_taunt_range_flat',
    'thunder_step_rewind_trail_damage_flat',
    'bodkin_blitz_damage_on_passthrough_flat',
    'glorious_battle_collision_knockback_flat',
    'glorious_battle_collision_impact_damage_multiplier_percent',
    'grasping_claws_cage_melee_damage_multiplier_percent',
    'holy_javelin_stun_duration_flat',
    'steel_trap_tether_damage_flat',
    'steel_trap_tether_range_flat',
    "sage's_insight_cooldown_rate_per_ability_reset_percent",
    "sage's_insight_damage_modifier_per_stack_percent",
    "sage's_insight_duration_flat",
]);

class CharmFormatter {
    // Item data stores each charm stat as { value, locked }; custom items
    // store a plain number. Normalise both so every charm renders either.
    static asValue(valueObj) {
        if (valueObj && typeof valueObj === 'object') return valueObj;
        return { value: valueObj, locked: false };
    }

    static camelCase(str) {
        if (!str) return '';
        return str
            .replaceAll('_', ' ')
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index == 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/[\s+ ]/g, '');
    }

    static toHumanReadable(stat, valueObj) {
        const { value, locked } = CharmFormatter.asValue(valueObj);
        let humanStr = stat
            .split('_')
            .filter((part) => part != 'm' && part != 'p' && part != 'bow' && part != 'tool')
            .map((part) => part[0].toUpperCase() + part.substring(1))
            .join(' ');

        humanStr = `${locked ? '🔒 ' : ''}${value > 0 ? '+' : ''}${value}${humanStr.includes(' Percent') ? '%' : ''} ${humanStr.replace(' Percent', '').replace(' Base', '').replace(' Flat', '')}`;

        return humanStr;
    }

    static statStyle(stat, valueObj) {
        const { value } = CharmFormatter.asValue(valueObj);
        const goodWhenNegative =
            (stat.includes('cooldown') &&
                !stat.includes('reduction') &&
                !stat.includes('recharge') &&
                !stat.includes('_cap')) || // need _cap because otherwise it matches esCAPe death
            stat.includes('price') ||
            (stat.includes('threshold') &&
                !stat.includes('rejuvenation') &&
                !stat.includes('coup') &&
                !stat.includes('meteor')) ||
            stat.includes('stacks_needed_for_activation_flat') || // ok that one's a little gross I admit
            stat.includes('self_damage') ||
            stat.includes('delay') ||
            stat.includes('penalty') ||
            stat.includes('requirement');
        if (goodWhenNegative) return value < 0 ? 'positiveCharm' : 'negativeCharm';
        if (value < 0) return 'negativeCharm';
        // A handful of charm stats display pink in-game (see PINK_CHARM_STATS).
        if (PINK_CHARM_STATS.has(stat)) return 'charmPink';
        return 'positiveCharm';
    }

    // Splits a charm stat into its label and value parts so the builder's
    // effect summary can render them like the regular stat cards
    // (label + monospace value).
    static charmStatParts(stat, valueObj) {
        const { value } = CharmFormatter.asValue(valueObj);
        let rawLabel = stat
            .split('_')
            .filter((part) => part != 'm' && part != 'p' && part != 'bow' && part != 'tool')
            .map((part) => part[0].toUpperCase() + part.substring(1))
            .join(' ');
        return {
            label: rawLabel.replace(' Percent', '').replace(' Base', '').replace(' Flat', ''),
            value: `${value > 0 ? '+' : ''}${value}${rawLabel.includes(' Percent') ? '%' : ''}`,
        };
    }

    // Exact per-stat color from the Monumenta API (items.json statColors);
    // null when unavailable so the class-based fallback applies.
    static statColor(stat, statColors) {
        return (statColors && statColors[stat]) || null;
    }

    static formatCharm(charm, statColors) {
        let formattedStats = [];

        for (const stat in charm) {
            if (charm[stat]) {
                const color = this.statColor(stat, statColors);
                formattedStats.push(
                    <span
                        className={styles[this.statStyle(stat, charm[stat])]}
                        style={color ? { color } : undefined}
                        key={stat}
                    >
                        {this.toHumanReadable(stat, charm[stat])}
                    </span>
                );
            }
        }

        return formattedStats;
    }
}

export default CharmFormatter;
