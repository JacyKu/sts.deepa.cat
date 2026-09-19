'use client';

import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { useTranslation } from './useTranslation';
import {
    isSearchCacheEnabled,
    isBuildsCacheEnabled,
    isCustomItemsCacheEnabled,
    setSearchCacheEnabled,
    setBuildsCacheEnabled,
    setCustomItemsCacheEnabled,
} from '../utils/cachePrefs';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

function CacheToggle({ label, hint, readPref, writePref, className } = {}) {
    const [enabled, setEnabled] = React.useState(true);
    React.useEffect(() => setEnabled(readPref()), [readPref]);
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={() => {
                    const next = !enabled;
                    setEnabled(next);
                    writePref(next);
                }}
                aria-label={label}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {label}
                <span className={itemsStyles.enchantTooltipText}>{hint}</span>
            </span>
        </label>
    );
}

// "Cache searches": whether the last item search survives page switches.
export function CacheSearchToggle({ className } = {}) {
    const t = useTranslation();
    return (
        <CacheToggle
            className={className}
            label={t('settings.cache.search.label')}
            hint={t('settings.cache.search.hint')}
            readPref={isSearchCacheEnabled}
            writePref={setSearchCacheEnabled}
        />
    );
}

// "Cache builds": whether builder state (draft autosave + custom skill order)
// is kept in this browser between visits.
export function CacheBuildsToggle({ className } = {}) {
    const t = useTranslation();
    return (
        <CacheToggle
            className={className}
            label={t('settings.cache.builds.label')}
            hint={t('settings.cache.builds.hint')}
            readPref={isBuildsCacheEnabled}
            writePref={setBuildsCacheEnabled}
        />
    );
}

// "Cache custom items": whether your custom items page restores its list
// instantly from this browser while the fresh list loads.
export function CacheCustomItemsToggle({ className } = {}) {
    const t = useTranslation();
    return (
        <CacheToggle
            className={className}
            label={t('settings.cache.customItems.label')}
            hint={t('settings.cache.customItems.hint')}
            readPref={isCustomItemsCacheEnabled}
            writePref={setCustomItemsCacheEnabled}
        />
    );
}
