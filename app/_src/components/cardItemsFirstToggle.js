'use client';

import React from 'react';
import itemsStyles from '../styles/Items.module.css';
import { useCardItemsFirst } from './items/cardItemsFirstContext';
import { useTranslation } from './useTranslation';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// Global default for the build card layout: equipped items on the card face
// with the skills in the hover panel (off = skills on the card, items on
// hover). The swap button on an individual card only changes that card.
export default function CardItemsFirstToggle({ className } = {}) {
    const { itemsFirst, setItemsFirst } = useCardItemsFirst();
    const t = useTranslation();
    return (
        <label className={className || ''}>
            <input
                type="checkbox"
                checked={itemsFirst}
                onChange={(e) => setItemsFirst(e.target.checked)}
                aria-label={t('settings.cardItemsFirst.label')}
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                {t('settings.cardItemsFirst.label')}
                <span className={itemsStyles.enchantTooltipText}>{t('settings.cardItemsFirst.hint')}</span>
            </span>
        </label>
    );
}
