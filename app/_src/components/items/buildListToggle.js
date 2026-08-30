import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useBuildListEnabled } from './buildListEnabledContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function BuildListToggle({ className } = {}) {
    const { enabled, toggle } = useBuildListEnabled();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label="Item import (Experimental)" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Item import (Experimental)
                <span className={itemsStyles.enchantTooltipText}>
                    Add items to a build list while browsing, then import the whole list into the builder at once.
                </span>
            </span>
        </label>
    );
}
