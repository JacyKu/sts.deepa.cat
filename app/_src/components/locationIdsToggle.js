'use client';

import React from 'react';
import itemsStyles from '../styles/Items.module.css';
import { useLocationIds } from './items/locationIdsContext';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// "Show location ids": item locations render their registry id behind the name
// ("Salazar's Folly (lime)") instead of the name alone, matching the Location
// filter. Locations the registry does not list (the region names, and event
// locations like Tenyears) keep the name alone.
export default function LocationIdsToggle({ className } = {}) {
    const { useIds, setUseIds } = useLocationIds();
    const t = useTranslation();
    return (
        <label className={className || ''}>
            <input
                type="checkbox"
                checked={useIds}
                onChange={(e) => setUseIds(e.target.checked)}
                aria-label={t('settings.locationIds.label')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.locationIds.label')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.locationIds.hint')}</span>
            </span>
        </label>
    );
}
