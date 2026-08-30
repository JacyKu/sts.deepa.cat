import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useFavouritesEnabled } from './favouritesEnabledContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function FavouritesToggle({ className } = {}) {
    const { enabled, toggle } = useFavouritesEnabled();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label="Favourites" />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Favourites
                <span className={itemsStyles.enchantTooltipText}>
                    Turn on the item favourites feature: favourite hearts on items, and favourited items sorted to the
                    top in the builder. Off by default.
                </span>
            </span>
        </label>
    );
}
