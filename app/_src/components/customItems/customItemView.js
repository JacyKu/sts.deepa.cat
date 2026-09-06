'use client';

import React from 'react';
import styles from '../../styles/CustomItems.module.css';
import { getStsBase } from '../../utils/base';
import StatFormatter from '../../utils/items/statFormatter';

function avatarSrc(item) {
    if (!item.authorAvatar) return null;
    if (item.authorAvatar.startsWith('http')) return item.authorAvatar;
    return `https://cdn.discordapp.com/avatars/${item.userId}/${item.authorAvatar}.png?size=32`;
}

// Item view for a custom item's link. Custom items are private to their
// creator: they are only ever merged into the owner's builder data, so other
// players can never see or use them - this page is an info/preview page for
// the creator (anyone else who opens the link just sees the privacy notice).
export default function CustomItemView({ item, isOwner }) {
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);

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

    const created = new Date(item.createdAt + 'Z').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1 className={styles.title}>Custom Item</h1>
                {isOwner ? (
                    <>
                        <p className={styles.muted}>
                            This custom item is private to you - it is linked to your Discord account, so no other
                            player can see it or use it in their builds.
                        </p>
                        <div className={styles.customItem}>
                            <div className={styles.cardTop}>
                                <div className={styles.cardTitle} title={item.name}>
                                    {item.name}
                                </div>
                            </div>
                            <div className={styles.cardTags}>
                                <span className={styles.tag}>{item.type}</span>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.imageIcon}>
                                    <div className={`monumenta-items monumenta-${item.textureToken}`}></div>
                                </div>
                                <div className={styles.stats}>{StatFormatter.formatStats(item.stats)}</div>
                            </div>
                            <div className={styles.cardBottom}>
                                <span className={styles.author} title={item.authorName || 'a player'}>
                                    {avatarSrc(item) && (
                                        <img
                                            className={styles.avatar}
                                            src={avatarSrc(item)}
                                            alt=""
                                            width={18}
                                            height={18}
                                        />
                                    )}
                                    {item.authorName || 'a player'}
                                </span>
                                <span className={styles.date}>{created}</span>
                            </div>
                            <div className={styles.itemActions}>
                                <a className={styles.addBtn} href={`${base}/custom-items`}>
                                    Manage your items
                                </a>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className={styles.muted}>
                        This custom item is private to its creator and cannot be seen or used by other players.
                    </p>
                )}
                <a className={styles.addBtn} href={`${base}/custom-items`}>
                    Back to Custom Items
                </a>
            </main>
        </div>
    );
}
