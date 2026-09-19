import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useMaxMasterwork } from './maxMasterworkContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function MaxMasterworkToggle({ className } = {}) {
    const { enabled, toggle } = useMaxMasterwork();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={toggle}
                aria-label={t('items.searchForm.maxMasterwork')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.maxMasterwork')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.maxMasterworkTooltip')}</span>
            </span>
        </label>
    );
}
