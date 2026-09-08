'use client';

// "American date format": MM/DD/YYYY instead of the browser locale's format.
// Off by default. Lives with the other localStorage-backed site toggles.
import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { isAmericanDateEnabled, setAmericanDateEnabled } from '../utils/dateFormat';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function DateFormatToggle({ className } = {}) {
    const [enabled, setEnabled] = React.useState(false);
    React.useEffect(() => setEnabled(isAmericanDateEnabled()), []);
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={() => {
                    const next = !enabled;
                    setEnabled(next);
                    setAmericanDateEnabled(next);
                }}
                aria-label="American date format"
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                American date format (MM/DD/YYYY)
                <span className={itemsStyles.enchantTooltipText}>
                    Show item and build dates as MM/DD/YYYY. Turn off to use your browser's usual date format.
                </span>
            </span>
        </label>
    );
}
