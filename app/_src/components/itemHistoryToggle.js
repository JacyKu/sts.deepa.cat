'use client';

import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { useItemHistory } from './items/itemHistoryContext';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// Settings switch for the per-item stat change history shown inside the item
// tiles on the items page.
export default function ItemHistoryToggle({ className } = {}) {
    const { enabled, setEnabled } = useItemHistory();
    const t = useTranslation();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label={t('settings.itemHistory.label')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.itemHistory.label')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.itemHistory.hint')}</span>
            </span>
        </label>
    );
}
