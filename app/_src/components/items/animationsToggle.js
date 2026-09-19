import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useAnimations } from '../animationsContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function AnimationsToggle({ className } = {}) {
    const { hidden, toggle } = useAnimations();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={hidden}
                onChange={toggle}
                aria-label={t('items.searchForm.hideItemAnimations')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.hideItemAnimations')}
                <span className={itemsStyles.enchantTooltipText}>
                    {t('items.searchForm.hideItemAnimationsTooltip')}
                </span>
            </span>
        </label>
    );
}
