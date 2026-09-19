'use client';

// "American date format": MM/DD/YYYY instead of the browser locale's format.
// Off by default. Lives with the other localStorage-backed site toggles.
import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { isAmericanDateEnabled, setAmericanDateEnabled } from '../utils/dateFormat';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

export default function DateFormatToggle({ className } = {}) {
    const t = useTranslation();
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
                aria-label={t('settings.dateFormat.aria')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.dateFormat.label')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.dateFormat.hint')}</span>
            </span>
        </label>
    );
}
