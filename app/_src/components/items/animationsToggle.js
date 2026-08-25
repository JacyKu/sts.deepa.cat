import React from 'react';
import searchStyles from '../../styles/SearchForm.module.css';
import { useAnimations } from '../animationsContext';

export default function AnimationsToggle({ className } = {}) {
    const { enabled, toggle } = useAnimations();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input type="checkbox" checked={enabled} onChange={toggle} aria-label="Animate item textures" />
            Animate item textures
        </label>
    );
}
