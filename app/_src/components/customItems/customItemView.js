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

// Read-only shared view. There is deliberately no way to copy this item into
// the builder or resave it: custom items are tied to their creator's Discord
// account and shared links are view-only.
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
                <p className={styles.muted}>
                    This item was created by {item.authorName || 'a player'} and is shared read-only - it cannot be
                    copied into a build or resaved.
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
                            Back to Custom Items
                        </a>
                        {isOwner && (
                            <a className={styles.addBtn} href={`${base}/custom-items`}>
                                Manage your items
                            </a>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
