import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useAnimations } from '../animationsContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function AnimationsToggle({ className } = {}) {
    const { hidden, toggle } = useAnimations();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide item animations" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Hide item animations
                <span className={itemsStyles.enchantTooltipText}>
                    Stop animated item textures from moving (swaying, pulsing, shimmering) for a calmer, static look.
                </span>
            </span>
        </label>
    );
}
