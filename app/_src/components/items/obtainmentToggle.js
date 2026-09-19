import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useHideObtainment } from './hideObtainmentContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function ObtainmentToggle({ className } = {}) {
    const { hidden, toggle } = useHideObtainment();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={hidden}
                onChange={toggle}
                aria-label={t('items.searchForm.hideObtainment')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.hideObtainment')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.hideObtainmentTooltip')}</span>
            </span>
        </label>
    );
}
