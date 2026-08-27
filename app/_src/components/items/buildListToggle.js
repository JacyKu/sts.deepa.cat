import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import { useBuildListEnabled } from './buildListEnabledContext';

export default function BuildListToggle({ className } = {}) {
    const { enabled, toggle } = useBuildListEnabled();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={toggle}
                aria-label="Item import (Experimental)"
            />
            Item import (Experimental)
        </label>
    );
}
