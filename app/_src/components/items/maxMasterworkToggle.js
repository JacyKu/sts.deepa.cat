import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import { useMaxMasterwork } from './maxMasterworkContext';

export default function MaxMasterworkToggle({ className } = {}) {
    const { enabled, toggle } = useMaxMasterwork();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label="Max masterwork" />
            Max masterwork
        </label>
    );
}
