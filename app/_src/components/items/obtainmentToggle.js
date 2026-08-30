import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideObtainment } from './hideObtainmentContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function ObtainmentToggle({ className } = {}) {
    const { hidden, toggle } = useHideObtainment();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide obtainment" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Hide obtainment
                <span className={itemsStyles.enchantTooltipText}>
                    Hide the obtainment hints on item tiles (how and where the item can be found).
                </span>
            </span>
        </label>
    );
}
