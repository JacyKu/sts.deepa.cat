import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useFavouritesEnabled } from './favouritesEnabledContext';
import { useTranslation } from '../useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function FavouritesToggle({ className } = {}) {
    const { enabled, toggle } = useFavouritesEnabled();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label={t('items.searchForm.favourites')} />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('items.searchForm.favourites')}
                <span className={itemsStyles.enchantTooltipText}>{t('items.searchForm.favouritesTooltip')}</span>
            </span>
        </label>
    );
}
