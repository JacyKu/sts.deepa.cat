'use client';

import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import {
    isSearchCacheEnabled,
    isBuildsCacheEnabled,
    setSearchCacheEnabled,
    setBuildsCacheEnabled,
} from '../utils/cachePrefs';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

function CacheToggle({ label, hint, readPref, writePref }) {
    const [enabled, setEnabled] = React.useState(true);
    React.useEffect(() => setEnabled(readPref()), [readPref]);
    return (
        <label className={`${searchStyles.toggleLabel} ${'loreToggle'}`}>
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
    return (
        <CacheToggle
            className={className}
            label="Cache searches"
            hint="Remember your last item search in this browser and restore it when you return. Turn off to always start fresh."
            readPref={isSearchCacheEnabled}
            writePref={setSearchCacheEnabled}
        />
    );
}

// "Cache builds": whether builder state (draft autosave + custom skill order)
// is kept in this browser between visits.
export function CacheBuildsToggle({ className } = {}) {
    return (
        <CacheToggle
            className={className}
            label="Cache builds"
            hint="Keep your current build draft and custom skill order in this browser. Turn off to never save or restore builder state."
            readPref={isBuildsCacheEnabled}
            writePref={setBuildsCacheEnabled}
        />
    );
}
