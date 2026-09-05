import React from 'react';
import styles from '../styles/Items.module.css';
import { useLanguageContext } from '../components/languageContext';
import SupportedLanguages from '../utils/translation/languages';

function formatTitle(str) {
    if (!str) return '';
    if (str.toLowerCase().includes('infinity')) return 'infinity';
    // Curses are keyed by their short name (e.g. "crippling") rather than the
    // full stat name ("curse_of_crippling"), so drop the prefix (and the
    // underscore that follows it) before camelizing - otherwise the leading
    // underscore makes the first letter uppercase and the lang key misses.
    if (str.startsWith('curse_of')) {
        str = str.slice('curse_of'.length).replace(/^_/, '');
    }
    return str
        .replaceAll('jungle_s', 'jungles')
        .replaceAll('_', ' ')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/[\s+-]/g, '');
}

export default function TranslatableEnchant({ title, className, children }) {
    const { lang } = useLanguageContext();
    const key = `items.enchant.${formatTitle(title)}`;
    const description = SupportedLanguages[lang][key];
    return (
        <span
            className={className ? `${styles.enchantTooltip} ${className}` : styles.enchantTooltip}
            key={`${lang}-${key}`}
        >
            {children}
            {description ? <span className={styles.enchantTooltipText}>{description}</span> : ''}
        </span>
    );
}
