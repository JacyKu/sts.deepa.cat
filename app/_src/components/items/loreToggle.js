import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideLore } from './hideLoreContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function LoreToggle({ className } = {}) {
    const { hidden, toggle } = useHideLore();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide lore" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Hide lore
                <span className={itemsStyles.enchantTooltipText}>
                    Keep only the quest-item lines in item descriptions; the rest of the lore text is hidden.
                </span>
            </span>
        </label>
    );
}
