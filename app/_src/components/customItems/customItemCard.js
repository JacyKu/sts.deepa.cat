'use client';

import React from 'react';
import Link from 'next/link';
import styles from '../../styles/CustomItems.module.css';
import StatFormatter from '../../utils/items/statFormatter';
import { formatDateString } from '../../utils/dateFormat';
import { loadItemSpriteMap, getMappedSpriteClass, isKnownSpriteToken } from '../../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../../utils/items/minecraftFallback';

// Custom items store a spritesheet token; if a later spritesheet import
// dropped it, fall back to the item's name mapping / base texture so the
// card never renders a wrong sheet cell.
function useIconClass(item) {
    const [spriteMap, setSpriteMap] = React.useState(null);
    React.useEffect(() => {
        let active = true;
        loadItemSpriteMap().then((map) => {
            if (active) setSpriteMap(map);
        });
        return () => {
            active = false;
        };
    }, []);
    if (!item.textureToken) {
        // In-game uploads may have no site sprite: use the vanilla base item.
        if (item.baseItem) return { base: 'minecraft', icon: `minecraft-${getMinecraftTextureKey(item.baseItem)}` };
        return { base: 'monumenta-items', icon: null };
    }
    if (!spriteMap || isKnownSpriteToken(spriteMap, item.textureToken)) {
        return { base: 'monumenta-items', icon: `monumenta-${item.textureToken}` };
    }
    const mapped = getMappedSpriteClass(spriteMap, item.name);
    if (mapped) return { base: 'monumenta-items', icon: mapped };
    if (item.baseItem) return { base: 'minecraft', icon: `minecraft-${getMinecraftTextureKey(item.baseItem)}` };
    return { base: 'monumenta-items', icon: null };
}

function avatarSrc(item) {
    if (!item.authorAvatar) return null;
    if (item.authorAvatar.startsWith('http')) return item.authorAvatar;
    return `https://cdn.discordapp.com/avatars/${item.userId}/${item.authorAvatar}.png?size=32`;
}

// The standard custom item card, shared by the My Items list, the share view
// and the favourites list. `href` turns the whole card into a link; the
// `heart`, `topRight` and `actions` slots wrap the standard title / tags /
// body / footer.
export default function CustomItemCard({
    item,
    href = null,
    heart = null,
    topRight = null,
    actions = null,
    authorFallback = 'You',
    className = '',
}) {
    const icon = useIconClass(item);
    // Rendered after mount so the user's date-format preference (stored in
    // the browser) can apply without a hydration mismatch.
    const [created, setCreated] = React.useState('');
    React.useEffect(() => {
        setCreated(formatDateString(item.createdAt));
    }, [item.createdAt]);

    const content = (
        <>
            <div className={styles.cardTop}>
                <div className={styles.cardTitle} title={item.name}>
                    {item.name}
                </div>
                {(heart || topRight) && (
                    <span className={styles.cardTopBtns}>
                        {heart}
                        {topRight}
                    </span>
                )}
            </div>
            <div className={styles.cardTags}>
                <span className={styles.tag}>{item.type}</span>
            </div>
            <div className={styles.cardBody}>
                <div className={styles.imageIcon}>
                    <div className={[icon.base, icon.icon].filter(Boolean).join(' ')}></div>
                </div>
                <div className={styles.stats}>{StatFormatter.formatStats(item.stats, item.statColors)}</div>
            </div>
            <div className={styles.cardBottom}>
                <span className={styles.author} title={item.authorName || authorFallback}>
                    {avatarSrc(item) && (
                        <img className={styles.avatar} src={avatarSrc(item)} alt="" width={18} height={18} />
                    )}
                    {item.authorName || authorFallback}
                </span>
                <span className={styles.date}>{created}</span>
            </div>
            {actions}
        </>
    );

    const cls = `${styles.customItem}${className ? ' ' + className : ''}`;
    if (href) {
        return (
            <Link href={href} className={cls}>
                {content}
            </Link>
        );
    }
    return <div className={cls}>{content}</div>;
}
