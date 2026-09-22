'use client';

// One date-format toggle. The two formats - American MM/DD/YYYY (under
// Accessibility) and YYYY/MM/DD (under Site settings) - are mutually
// exclusive: both write the same setting, so switching one on switches the
// other off. With both off, dates follow the browser's locale.
import React from 'react';
import itemsStyles from '../styles/Items.module.css';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function DateFormatToggle({ checked, onChange, labelKey, hintKey, className } = {}) {
    const t = useTranslation();
    return (
        <label className={className || ''}>
            <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(event) => onChange(event.target.checked)}
                aria-label={t(labelKey)}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t(labelKey)}
                <span className={itemsStyles.enchantTooltipText}>{t(hintKey)}</span>
            </span>
        </label>
    );
}
