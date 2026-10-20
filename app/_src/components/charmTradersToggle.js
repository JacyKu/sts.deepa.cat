'use client';

import React from 'react';
import itemsStyles from '../styles/Items.module.css';
import { useCharmTraders } from './items/charmTradersContext';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// "Show charm traders": basic charm tiles list the NPC that sells them and the
// coordinates from the wiki's charm trader list.
export default function CharmTradersToggle({ className } = {}) {
    const { show, setShow } = useCharmTraders();
    const t = useTranslation();
    return (
        <label className={className || ''}>
            <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
                aria-label={t('settings.charmTraders.label')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.charmTraders.label')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.charmTraders.hint')}</span>
            </span>
        </label>
    );
}
