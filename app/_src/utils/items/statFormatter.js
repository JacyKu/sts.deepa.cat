import styles from '../../styles/Items.module.css';
import TranslatableEnchant from '../../components/translatableEnchant';

const Formats = {
    ENCHANT: 0,
    SINGLE_ENCHANT: 1,
    ATTRIBUTE: 2,
    CURSE: 3,
    SINGLE_CURSE: 4,
    BASE_STAT: 5,
};

// Stats are rendered entirely from the item data - no stat registry is
// maintained by hand. New enchants added to the API show up automatically.
// The display format is inferred from the stat key's naming convention and
// its value:
//   - "curse_of_*" / "curse_*" / "*_fragility" / plain curse names -> curse (red, level shown)
//   - "*_percent" / "*_flat"    -> attribute ("+15% ...", "+5 ...")
//   - "*_base"                  -> base stat ("116 ...")
//   - plain name + positive int -> enchant level ("Absorbing Barrier 4")
//   - anything else             -> attribute
//
// armor/agility are the only stats that break these conventions (plain
// names that are attributes), so they get a small explicit exception.
// A few curses (Two Handed, Starvation, Ineptitude, Cumbersome, Oversized)
// also use plain names, so they are listed explicitly.

const PLAIN_ATTRIBUTES = new Set(['armor', 'agility']);
const PLAIN_CURSES = new Set(['two_handed', 'starvation', 'ineptitude', 'cumbersome', 'oversized']);
const HIDDEN_STATS = new Set(['noglint']); // internal flag with no display meaning

// Display colors match the Monumenta plugin (AttributeType.getDisplay /
// EnchantmentType.getDisplay): armor and agility are a light cyan, the
// mainhand attributes dark green, other attributes blue, enchantments gray,
// and anything negative red.
const ARMOR_AGILITY_STATS = new Set(['armor', 'agility']);
const MAINHAND_ATTRIBUTES = new Set([
    'attack_damage',
    'attack_speed',
    'projectile_damage',
    'projectile_speed',
    'throw_rate',
    'potion_damage',
    'potion_radius',
    'potion_recharge_rate',
]);

function attributeBaseName(name) {
    return name.replace(/_percent$/, '').replace(/_flat$/, '').replace(/_base$/, '');
}

function inferFormat(name, value) {
    if (PLAIN_ATTRIBUTES.has(name)) return Formats.ATTRIBUTE;
    if (name.startsWith('curse_')) return Formats.CURSE;
    if (name.endsWith('_fragility')) return Formats.CURSE;
    if (PLAIN_CURSES.has(name)) return Formats.CURSE;
    if (name.endsWith('_percent') || name.endsWith('_flat')) return Formats.ATTRIBUTE;
    if (name.endsWith('_base')) return Formats.BASE_STAT;
    if (Number.isInteger(value) && value >= 1) return Formats.ENCHANT;
    return Formats.ATTRIBUTE;
}

function formatRank(format) {
    switch (format) {
        case Formats.ENCHANT:
        case Formats.SINGLE_ENCHANT:
            return 0;
        case Formats.ATTRIBUTE:
            return 1;
        case Formats.BASE_STAT:
            return 2;
        default:
            return 3; // curses
    }
}

class StatFormatter {
    static camelCase(str) {
        if (!str) return '';
        return str
            .replaceAll('_', ' ')
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index == 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/[\s+ ]/g, '');
    }

    static toHumanReadable(stat, value) {
        let humanStr = stat.name
            .split('_')
            .filter((part) => part != 'm' && part != 'p' && part != 'bow' && part != 'tool')
            .map((part) => part[0].toUpperCase() + part.substring(1))
            .join(' ');
        humanStr = humanStr.replace(' Of ', ' of '); // curses, ashes, rage of the keter
        humanStr = humanStr.replace(' The ', ' the '); // rage of the keter, curse of the veil
        humanStr = humanStr.replace('Jungles', "Jungle's"); // kapple
        switch (stat.format) {
            case Formats.ENCHANT: {
                humanStr = `${humanStr} ${value}`;
                break;
            }
            case Formats.SINGLE_ENCHANT: {
                // The level should not be displayed. humanStr is already good to go.
                break;
            }
            case Formats.ATTRIBUTE: {
                humanStr = `${value > 0 ? '+' : ''}${value}${humanStr.includes(' Percent') || humanStr == 'Spell Power Base' ? '%' : ''} ${humanStr.replace(' Percent', '').replace(' Base', '').replace(' Flat', '')}`;
                break;
            }
            case Formats.CURSE: {
                humanStr = `${humanStr} ${value}`;
                break;
            }
            case Formats.SINGLE_CURSE: {
                // The level should not be displayed. humanStr is already good to go.
                break;
            }
            case Formats.BASE_STAT: {
                humanStr = `${value} ${humanStr.replace(' Base', '').replace(' Flat', '')}`;
                break;
            }
        }
        return humanStr;
    }

    static statStyle(stat, value, type) {
        switch (stat.format) {
            case Formats.ATTRIBUTE: {
                if (value < 0) return 'negativeStat';
                const base = attributeBaseName(stat.name);
                if (ARMOR_AGILITY_STATS.has(base)) return 'statArmorAgility';
                if (MAINHAND_ATTRIBUTES.has(base)) return 'statMainhand';
                return 'statAttribute';
            }
            case Formats.CURSE:
            case Formats.SINGLE_CURSE: {
                return 'negativeStat';
            }
            case Formats.BASE_STAT: {
                return 'baseStats';
            }
            default: {
                return 'statEnchant';
            }
        }
    }

    static formatStats(stats) {
        if (stats == undefined) {
            return '';
        }

        const getStatValue = (value) => {
            if (value === undefined || value === null) {
                return undefined;
            }
            if (typeof value === 'object' && 'value' in value) {
                return value.value;
            }
            return value;
        };

        const entries = [];
        for (const name of Object.keys(stats)) {
            if (HIDDEN_STATS.has(name)) continue;
            const rawValue = getStatValue(stats[name]);
            if (rawValue === undefined) continue;
            entries.push({ name, rawValue, format: inferFormat(name, rawValue) });
        }

        // Group by stat type (enchants, attributes, base stats, curses),
        // then alphabetically within each group.
        entries.sort((a, b) => {
            const rankDiff = formatRank(a.format) - formatRank(b.format);
            if (rankDiff !== 0) return rankDiff;
            return a.name.localeCompare(b.name);
        });

        return entries.map(({ name, rawValue, format }) => (
            <TranslatableEnchant key={name} title={name} className={styles[this.statStyle({ name, format }, rawValue)]}>
                {this.toHumanReadable({ name, format }, rawValue)}
            </TranslatableEnchant>
        ));
    }
}

export default StatFormatter;
