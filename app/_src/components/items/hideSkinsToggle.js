import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import { useHideSkins } from './hideSkinsContext';

export default function HideSkinsToggle({ className } = {}) {
    const { hidden, toggle } = useHideSkins();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide skinned items" />
            Hide skinned items
        </label>
    );
}
