import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideLore } from './hideLoreContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function LoreToggle({ className } = {}) {
    const { hidden, toggle } = useHideLore();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label={t('items.searchForm.hideLore')} />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.hideLore')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.hideLoreTooltip')}</span>
            </span>
        </label>
    );
}
