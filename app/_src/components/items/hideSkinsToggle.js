import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideSkins } from './hideSkinsContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function HideSkinsToggle({ className } = {}) {
    const { hidden, toggle } = useHideSkins();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide skinned items" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Hide skinned items
                <span className={itemsStyles.enchantTooltipText}>
                    Filter the item list down to the base items, hiding skin variants of the same gear.
                </span>
            </span>
        </label>
    );
}
