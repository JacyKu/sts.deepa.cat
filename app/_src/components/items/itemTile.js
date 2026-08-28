import Enchants from './enchants';
import LoreText from './loreText';
import styles from '../../styles/Items.module.css';
import TranslatableText from '../translatableText';
import React from 'react';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../../utils/items/minecraftFallback';
import { useHideLore } from './hideLoreContext';
import { useHideObtainment } from './hideObtainmentContext';
import { useLowResource } from '../lowResourceContext';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';
import { useItemFavourites } from './itemFavouritesContext';

function camelCase(str, upper) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 && !upper ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function getItemType(item) {
    if (item.type != undefined) {
        return camelCase(item.type);
    }
    return 'misc';
}

function getItemsheetClass(itemName) {
    return `monumenta-${camelCase(
        itemName
            .replace(/^EX\s+/, '') // EX items share the base item's texture
            .replaceAll('-', '')
            .replaceAll('.', '')
            .replaceAll("'", '')
            .replace(/\(.*\)/g, '')
            .trim()
            .replaceAll(' ', '-')
            .replaceAll('_', '-')
            .toLowerCase(),
        true
    )}`;
}

function doesNameContainNonASCII(name) {
    for (let i = 0; i < name.length; i++) {
        if (name.charCodeAt(i) > 127) {
            return true;
        }
    }
    return false;
}

export default function ItemTile(data) {
    const item = data.item;
    const { hidden: hideLore } = useHideLore();
    const { hidden: hideObtainment } = useHideObtainment();
    const { lowRes } = useLowResource();
    const { items: listItems, toggleItem } = useBuildList();
    const { enabled: buildListEnabled } = useBuildListEnabled();
    const { favouriteSet, authenticated, toggle: toggleFavourite } = useItemFavourites();
    const [cssClass, setCssClass] = React.useState(getItemsheetClass(item.name));
    const [baseBackgroundClass, setBaseBackgroundClass] = React.useState('monumenta-items');
    const [spriteMap, setSpriteMap] = React.useState(null);

    // If the item name has accented characters, they are actually not present in the item's name property,
    // but they are present in the item's key. In that case, set the name to the key.
    if (doesNameContainNonASCII(data.name)) {
        item.name = data.name;
    }

    React.useEffect(() => {
        let active = true;
        loadItemSpriteMap().then((map) => {
            if (active) {
                setSpriteMap(map);
            }
        });
        return () => {
            active = false;
        };
    }, []);

    React.useEffect(() => {
        // Custom items carry their chosen texture directly; regular items go
        // through the sprite map (preferred) or the legacy name heuristic.
        const mappedClass = item.textureToken
            ? `monumenta-${item.textureToken}`
            : getMappedSpriteClass(spriteMap, item.name);
        if (mappedClass) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(mappedClass);
            return;
        }

        // While the sprite map is still loading, fall back to the legacy class-name heuristic.
        if (!spriteMap) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(getItemsheetClass(item.name));
            return;
        }

        // Otherwise, default to a minecraft texture.
        setBaseBackgroundClass('minecraft');
        setCssClass(`minecraft-${getMinecraftTextureKey(item['base_item'])}`);
    }, [item, spriteMap]);

    return (
        <div className={`${styles.itemTile} ${data.hidden ? styles.hidden : ''}`}>
            {buildListEnabled && data.showListButton && (
                <button
                    type="button"
                    className={`${styles.listAddButton}${listItems.includes(item.name) ? ` ${styles.listAddButtonOn}` : ''}`}
                    onClick={() => toggleItem(item.name, item.type)}
                    aria-label={
                        listItems.includes(item.name)
                            ? `Remove ${item.name} from build list`
                            : `Add ${item.name} to build list`
                    }
                >
                    {listItems.includes(item.name) ? '✓' : '+'}
                </button>
            )}
            {data.showFavouriteButton && (
                <button
                    type="button"
                    className={`${styles.favouriteButton}${favouriteSet.has(item.name) ? ` ${styles.favouriteButtonOn}` : ''}`}
                    onClick={() =>
                        authenticated
                            ? toggleFavourite(item.name)
                            : (window.location.href = `/api/auth/discord/login?next=${encodeURIComponent(
                                  window.location.pathname + window.location.search
                              )}`)
                    }
                    aria-label={
                        favouriteSet.has(item.name)
                            ? `Remove ${item.name} from favourites`
                            : authenticated
                              ? `Add ${item.name} to favourites`
                              : 'Log in to favourite'
                    }
                    title={favouriteSet.has(item.name) ? 'Remove from favourites' : 'Add to favourites'}
                >
                    <svg viewBox="0 0 512 512" width="15" height="15" aria-hidden="true">
                        <path
                            fill={favouriteSet.has(item.name) ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="36"
                            d="M47.6 300.4 228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96.5 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"
                        />
                    </svg>
                </button>
            )}
            <div className={styles.imageIcon}>
                {lowRes ? (
                    <div className={styles.lowResIcon}></div>
                ) : (
                    <div className={[baseBackgroundClass, cssClass].join(' ')}></div>
                )}
            </div>
            <span
                className={`${styles[camelCase(item.location)]} ${item.tier == 'Tier 3' && item.region == 'Ring' ? styles['tier5'] : styles[camelCase(item.tier)]} ${styles.name}`}
            >
                <a
                    href={`https://monumenta.wiki.gg/wiki/${item.name
                        .replace(/\(.*\)/g, '')
                        .trim()
                        .replaceAll(' ', '_')}`}
                    target="_blank"
                    rel="noreferrer"
                >
                    {item.name}
                </a>
            </span>
            <span className={styles.infoText}>
                <TranslatableText identifier={`items.type.${getItemType(item)}`}></TranslatableText>
                {` - ${item['base_item']} `}
            </span>
            {item['original_item'] ? (
                <span className={styles.infoText}>{`Skin for ${item['original_item']} `}</span>
            ) : (
                ''
            )}
            <Enchants item={item}></Enchants>
            <span>
                <span className={styles.infoText}>{`${item.region ? item.region : ''} `}</span>
                <span className={styles[camelCase(item.tier)]}>{item.tier}</span>
            </span>
            <span className={styles[camelCase(item.location)]}>{item.location}</span>
            {item.lore ? <LoreText text={item.lore} className={styles.infoText} questOnly={hideLore} /> : ''}
            {!hideObtainment && (
                <>
                    {item.extras?.poi ? (
                        <p className={`${styles.infoText} m-0`}>{`Found in ${item.extras.poi}`}</p>
                    ) : (
                        ''
                    )}
                    {item.extras?.notes ? <p className={`${styles.infoText} m-0`}>{item.extras.notes}</p> : ''}
                </>
            )}
        </div>
    );
}
