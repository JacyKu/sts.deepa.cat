'use client';

import React from 'react';
import dbStyles from '../../styles/Database.module.css';
import itemsStyles from '../../styles/Items.module.css';
import { useTranslation } from '../useTranslation';

// Heart button + count for custom items, styled like the build cards'
// favourite button. Guests can see the count but cannot toggle it.
export default function CustomItemHeart({ itemId, favourite, count, user, onChange, className = '' }) {
    const t = useTranslation();
    const [state, setState] = React.useState({ favourite: Boolean(favourite), count: count || 0 });
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        setState({ favourite: Boolean(favourite), count: count || 0 });
    }, [favourite, count]);

    function toggle(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!user || busy) return;
        setBusy(true);
        fetch(`/api/v2/custom-items/${itemId}/favourite`, { method: state.favourite ? 'DELETE' : 'POST' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => {
                setState({ favourite: d.favourite, count: d.count });
                if (onChange) onChange(d);
            })
            .catch(() => {})
            .finally(() => setBusy(false));
    }

    const tip = !user
        ? t('customItems.heart.loginToFavourite')
        : state.favourite
          ? t('customItems.heart.removeFromFavourites')
          : t('customItems.heart.addToFavourites');

    return (
        <button
            type="button"
            className={`${dbStyles.favBtn}${state.favourite ? ` ${dbStyles.favBtnOn}` : ''}${
                className ? ' ' + className : ''
            }`}
            onClick={toggle}
            aria-label={tip}
            aria-pressed={state.favourite}
        >
            <span
                className={itemsStyles.enchantTooltip}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
                <svg viewBox="0 0 512 512" width="15" height="15" aria-hidden="true">
                    <path
                        fill={state.favourite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="36"
                        d="M47.6 300.4 228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96.5 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"
                    />
                </svg>
                <span className={dbStyles.favCount}>{state.count || 0}</span>
                <span className={itemsStyles.enchantTooltipText}>{tip}</span>
            </span>
        </button>
    );
}
