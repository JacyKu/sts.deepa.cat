import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideSkins } from './hideSkinsContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function HideSkinsToggle({ className } = {}) {
    const { hidden, toggle } = useHideSkins();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label={t('items.searchForm.hideSkins')} />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.hideSkins')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.hideSkinsTooltip')}</span>
            </span>
        </label>
    );
}
