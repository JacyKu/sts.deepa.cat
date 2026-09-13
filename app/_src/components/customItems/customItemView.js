'use client';

import React from 'react';
import styles from '../../styles/CustomItems.module.css';
import { getStsBase } from '../../utils/base';
import CustomItemCard from './customItemCard';
import CustomItemHeart from './customItemHeart';

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
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);

    // null = idle | 'saving' | 'copied' | 'error'
    const [copyState, setCopyState] = React.useState(null);
    const copyBusyRef = React.useRef(false);

    if (!item) {
        return (
            <div className={styles.page}>
                <main className={styles.main}>
                    <h1 className={styles.title}>Custom Item</h1>
                    <p className={styles.muted}>This custom item does not exist or has been deleted.</p>
                    <a className={styles.addBtn} href={`${base}/custom-items`}>
                        Back to Custom Items
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
                const response = await fetch(`${base}/api/v1/custom-items`, {
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
                <h1 className={styles.title}>Custom Item</h1>
                {!isOwner && (
                    <p className={styles.muted}>
                        {item.authorName
                            ? `A custom item shared by ${item.authorName}.`
                            : 'A custom item shared by another player.'}{' '}
                        Copy it into your own list to edit it or use it in the builder.
                    </p>
                )}
                <CustomItemCard
                    item={item}
                    authorFallback="a player"
                    heart={
                        <CustomItemHeart
                            itemId={item.id}
                            favourite={item.myFavourite}
                            count={item.favouriteCount}
                            user={loggedIn ? true : null}
                        />
                    }
                    actions={
                        <div className={styles.cardActions}>
                            {!loggedIn ? (
                                <a
                                    className={styles.rowBtn}
                                    href={`/api/auth/discord/login?next=${encodeURIComponent(
                                        `/custom-items/${item.id}`
                                    )}`}
                                >
                                    Log in to copy
                                </a>
                            ) : copyState === 'copied' ? (
                                <>
                                    <span className={styles.copyDone}>Copied into your items.</span>
                                    <a className={styles.rowBtn} href={`${base}/custom-items`}>
                                        Manage your items
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
                                        ? 'Copying…'
                                        : isOwner
                                          ? 'Duplicate this item'
                                          : 'Copy to my items'}
                                </button>
                            )}
                            {isOwner && copyState !== 'copied' && (
                                <a className={styles.rowBtn} href={`${base}/custom-items`}>
                                    Manage your items
                                </a>
                            )}
                        </div>
                    }
                />
                {copyState === 'error' && <p className={styles.errorText}>Could not copy the item. Try again.</p>}
            </main>
        </div>
    );
}
