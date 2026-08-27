import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import { useHideObtainment } from './hideObtainmentContext';

export default function ObtainmentToggle({ className } = {}) {
    const { hidden, toggle } = useHideObtainment();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={hidden} onChange={toggle} aria-label="Hide obtainment" />
            Hide obtainment
        </label>
    );
}
