import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useMaxMasterwork } from './maxMasterworkContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function MaxMasterworkToggle({ className } = {}) {
    const { enabled, toggle } = useMaxMasterwork();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label="Max masterwork" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Max masterwork
                <span className={itemsStyles.enchantTooltipText}>
                    Show masterworkable items at their maximum masterwork variant by default instead of the lowest.
                </span>
            </span>
        </label>
    );
}
