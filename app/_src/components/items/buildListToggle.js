import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useBuildListEnabled } from './buildListEnabledContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function BuildListToggle({ className } = {}) {
    const { enabled, toggle } = useBuildListEnabled();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label={t('items.searchForm.itemImport')} />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.itemImport')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.itemImportTooltip')}</span>
            </span>
        </label>
    );
}
