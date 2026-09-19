import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { useBuilderLayout } from './builderLayoutContext';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// Experimental builder layout toggle: equipment slot inputs on the left
// (rows of two) with the stats on the right. Off by default; mobile always
// uses the standard layout.
export default function BuilderLayoutToggle({ className } = {}) {
    const { newLayout, toggle } = useBuilderLayout();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={newLayout}
                onChange={toggle}
                aria-label={t('settings.builderLayout.newLayoutAria')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.builderLayout.newLayout')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.builderLayout.hint')}</span>
            </span>
        </label>
    );
}
