'use client';

import React from 'react';
import searchStyles from '../styles/SearchForm.module.css';
import itemsStyles from '../styles/Items.module.css';
import { useCardItemsFirst } from './items/cardItemsFirstContext';

const tooltipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5 };

// Global default for the build card layout: equipped items on the card face
// with the skills in the hover panel (off = skills on the card, items on
// hover). The swap button on an individual card only changes that card.
export default function CardItemsFirstToggle({ className } = {}) {
    const { itemsFirst, setItemsFirst } = useCardItemsFirst();
    return (
        <label className={`${searchStyles.toggleLabel} ${className || ''}`}>
            <input
                type="checkbox"
                checked={itemsFirst}
                onChange={(e) => setItemsFirst(e.target.checked)}
                aria-label="Items on cards"
            />
            <span className={itemsStyles.enchantTooltip} style={tooltipStyle}>
                Items on cards
                <span className={itemsStyles.enchantTooltipText}>
                    Show equipped items on build cards and put the skills in the hover panel. The swap button on a
                    card changes just that card.
                </span>
            </span>
        </label>
    );
}
