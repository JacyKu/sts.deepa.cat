'use client';

import React from 'react';
import styles from '../../styles/CustomItems.module.css';
import { getStsBase } from '../../utils/base';
import CustomItemCard from './customItemCard';
import CustomItemHeart from './customItemHeart';
import { useTranslation } from '../useTranslation';

function duplicateName(base, attempt) {
    if (attempt === 0) return base;
    const tag = attempt === 1 ? 'copy' : `copy ${attempt}`;
    const candidate = `${base} (${tag})`;
    return candidate.length > 64 ? candidate.slice(0, 61) + '...' : candidate;
}

// Item view for a custom item's share link. The link is public: anyone can
// see the item and its author. Logged-in visitors (including the owner) can
// duplicate it into their own item list, then edit or build with it. The
// duplicate is created through the normal create route, which stamps the
// copy with the viewer's account.
export default function CustomItemView({ item, isOwner, loggedIn }) {
    const t = useTranslation();
    const base = getStsBase();

    // null = idle | 'saving' | 'copied' | 'error'
    const [copyState, setCopyState] = React.useState(null);
    const copyBusyRef = React.useRef(false);
    // Owner visibility switch: public items are open to everyone, private
    // items are only visible here (to their owner).
    const [isPublic, setIsPublic] = React.useState(item ? item.isPublic !== false : true);
    const [publicBusy, setPublicBusy] = React.useState(false);
    const [visibilityError, setVisibilityError] = React.useState(false);

    async function togglePublic() {
        if (publicBusy) return;
        setPublicBusy(true);
        setVisibilityError(false);
        try {
            const response = await fetch(`${base}/api/v2/custom-items/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: !isPublic }),
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            setIsPublic(data && data.item ? Boolean(data.item.isPublic) : !isPublic);
        } catch (e) {
            setVisibilityError(true);
        } finally {
            setPublicBusy(false);
        }
    }

    if (!item) {
        return (
            <div className={styles.page}>
                <main className={styles.main}>
                    <h1 className={styles.title}>{t('customItems.view.title')}</h1>
                    <p className={styles.muted}>{t('customItems.view.notFound')}</p>
                    <a className={styles.addBtn} href={`${base}/custom-items`}>
                        {t('customItems.view.backToItems')}
                    </a>
                </main>
            </div>
        );
    }

    // Retry the name with a " (copy)" / " (copy 2)" suffix while the viewer
    // already owns an item with that name; anything else is a real failure.
    async function duplicateItem() {
        if (copyBusyRef.current) return;
        copyBusyRef.current = true;
        setCopyState('saving');
        let attempt = 0;
        try {
            while (attempt < 50) {
                const response = await fetch(`${base}/api/v2/custom-items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: duplicateName(item.name, attempt),
                        type: item.type,
                        textureToken: item.textureToken,
                        textureName: item.textureName || null,
                        stats: item.stats || {},
                        baseItem: item.baseItem || null,
                    }),
                });
                if (response.status === 409) {
                    attempt += 1;
                    continue;
                }
                if (!response.ok) {
                    setCopyState('error');
                    return;
                }
                setCopyState('copied');
                return;
            }
            setCopyState('error');
        } catch (e) {
            setCopyState('error');
        } finally {
            copyBusyRef.current = false;
        }
    }

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>{t('customItems.view.title')}</h1>
                {!isOwner && (
                    <p className={styles.muted}>
                        {item.authorName
                            ? `${t('customItems.view.sharedBy')} ${item.authorName}.`
                            : t('customItems.view.sharedByAnother')}{' '}
                        {t('customItems.view.copyHint')}
                    </p>
                )}
                <CustomItemCard
                    item={{ ...item, isPublic }}
                    authorFallback={t('customItems.card.aPlayer')}
                    heart={
                        isPublic ? (
                            <CustomItemHeart
                                itemId={item.id}
                                favourite={item.myFavourite}
                                count={item.favouriteCount}
                                user={loggedIn ? true : null}
                            />
                        ) : null
                    }
                    actions={
                        <div className={styles.cardActions}>
                            {isOwner && (
                                <button
                                    type="button"
                                    className={`${styles.rowBtn}${isPublic ? ` ${styles.rowBtnPublic}` : ''}`}
                                    onClick={togglePublic}
                                    disabled={publicBusy}
                                    title={isPublic ? t('database.unpublish') : t('database.publicise')}
                                >
                                    {isPublic ? t('database.publicBadge') : t('database.publicise')}
                                </button>
                            )}
                            {!loggedIn ? (
                                <a
                                    className={styles.rowBtn}
                                    href={`/api/auth/discord/login?next=${encodeURIComponent(
                                        `/custom-items/${item.id}`
                                    )}`}
                                >
                                    {t('customItems.view.loginToCopy')}
                                </a>
                            ) : copyState === 'copied' ? (
                                <>
                                    <span className={styles.copyDone}>{t('customItems.view.copied')}</span>
                                    <a className={styles.rowBtn} href={`${base}/custom-items`}>
                                        {t('customItems.view.manageItems')}
                                    </a>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.rowBtn}
                                    onClick={duplicateItem}
                                    disabled={copyState === 'saving'}
                                >
                                    {copyState === 'saving'
                                        ? t('customItems.view.copying')
                                        : isOwner
                                          ? t('customItems.view.duplicate')
                                          : t('customItems.view.copyToItems')}
                                </button>
                            )}
                            {isOwner && copyState !== 'copied' && (
                                <a className={styles.rowBtn} href={`${base}/custom-items`}>
                                    {t('customItems.view.manageItems')}
                                </a>
                            )}
                        </div>
                    }
                />
                {copyState === 'error' && <p className={styles.errorText}>{t('customItems.view.copyError')}</p>}
                {visibilityError && <p className={styles.errorText}>{t('customItems.visibilityError')}</p>}
            </main>
        </div>
    );
}
