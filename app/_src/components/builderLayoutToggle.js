import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { useBuilderLayout } from './builderLayoutContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// Experimental builder layout toggle: equipment slot inputs on the left
// (rows of two) with the stats on the right. Off by default; mobile always
// uses the standard layout.
export default function BuilderLayoutToggle({ className } = {}) {
    const { newLayout, toggle } = useBuilderLayout();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={newLayout} onChange={toggle} aria-label="New Layout" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                New Layout (Experimental)
                <span className={itemsStyles.enchantTooltipText}>
                    Put the equipment slot inputs in a column on the left (rows of two) with the stats on the right.
                    Mobile keeps the standard layout.
                </span>
            </span>
        </label>
    );
}
