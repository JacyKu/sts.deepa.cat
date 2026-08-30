import Enchants from './enchants';
import LoreText from './loreText';
import styles from '../../styles/Items.module.css';
import React from 'react';
import TranslatableText from '../translatableText';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../../utils/items/minecraftFallback';
import { useHideLore } from './hideLoreContext';
import { useHideObtainment } from './hideObtainmentContext';
import { useMaxMasterwork } from './maxMasterworkContext';
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

const maxMasterwork = {
    Rare: 4,
    Artifact: 4,
    Epic: 6,
};

const undiscovered = {
    UNDISCOVERED: 1,
    DOES_NOT_EXIST: 2,
};

function getLowestMasterworkItem(items) {
    let min = items[0];
    for (let i = 1; i < items.length; i++) {
        if (items[i].masterwork < min.masterwork) {
            min = items[i];
        }
    }
    return min;
}

function getItemWithMasterwork(items, masterwork, itemData, name) {
    let minMasterwork = getLowestMasterworkItem(items).masterwork;
    if (masterwork >= minMasterwork) {
        for (let item of items) {
            if (Number(item.masterwork) === masterwork) {
                return item;
            }
        }
        // Search filters can prune a masterwork group to just the variants
        // that matched (e.g. tier = Rare drops the Artifact masterwork-4
        // variant). Before declaring the item undiscovered, resolve against
        // the full dataset so clicking a higher star still works.
        if (itemData && name) {
            for (const key of Object.keys(itemData)) {
                const item = itemData[key];
                if (item.name === name && Number(item.masterwork) === masterwork) {
                    return item;
                }
            }
        }
    }
    let undiscoveredItem = {};
    // Need to create a copy of the object or it will modify the original object if I simply equal them.
    for (let key of Object.keys(items[0])) {
        switch (key) {
            case 'stats': {
                undiscoveredItem.stats = {};
                break;
            }
            case 'masterwork': {
                undiscoveredItem.masterwork = masterwork;
                break;
            }
            default: {
                undiscoveredItem[key] = items[0][key];
                break;
            }
        }
    }
    masterwork < minMasterwork
        ? (undiscoveredItem.undiscovered = undiscovered.DOES_NOT_EXIST)
        : (undiscoveredItem.undiscovered = undiscovered.UNDISCOVERED);
    return undiscoveredItem;
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function animate(star, index, starIntervals) {
    if (star.current) {
        star.current.style.setProperty('--star-left', `${random(-20, 80)}%`);
        star.current.style.setProperty('--star-top', `${random(-50, 70)}%`);

        // Use DOM Reflow to restart the animation
        star.current.style.animation = 'none';
        star.current.offsetHeight;
        star.current.style.animation = '';
    } else {
        clearTimeout(starIntervals[index]);
    }
}

function getItemsheetClass(itemName) {
    return `monumenta-${camelCase(
        itemName
            .replace(/\(.*\)/g, '')
            .replace(/^EX\s+/, '') // EX items share the base item's texture
            .replaceAll("'", '')
            .replaceAll('.', '')
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

export default function MasterworkableItemTile(data) {
    // This is an array
    const item = data.item;
    const { hidden: hideLore } = useHideLore();
    const { hidden: hideObtainment } = useHideObtainment();
    const { enabled: maxMasterworkDefault } = useMaxMasterwork();
    const { lowRes } = useLowResource();
    const { items: listItems, toggleItem } = useBuildList();
    const { enabled: buildListEnabled } = useBuildListEnabled();
    const { favouriteSet, authenticated, enabled, toggle: toggleFavourite } = useItemFavourites();

    // If the item name has accented characters, they are actually not present in the item's name property,
    // but they are present in the item's key. In that case, set the name to the key.
    if (doesNameContainNonASCII(data.name)) {
        for (let masterworkItem of data.item) {
            masterworkItem.name = data.name;
        }
    }

    // The "Max masterwork" menu toggle makes every masterworkable item open on
    // its highest available variant instead of the lowest.
    function computeDefaultItem() {
        if (data.default) {
            return getItemWithMasterwork(item, data.default, data.itemData, data.name);
        }
        if (maxMasterworkDefault) {
            const highest = Math.max(0, ...item.map((i) => Number(i.masterwork) || 0));
            return getItemWithMasterwork(item, highest, data.itemData, data.name);
        }
        return getLowestMasterworkItem(item);
    }
    const [activeItem, setActiveItem] = React.useState(computeDefaultItem);
    const [cssClass, setCssClass] = React.useState(getItemsheetClass(activeItem.name));
    const [baseBackgroundClass, setBaseBackgroundClass] = React.useState('monumenta-items');
    const [spriteMap, setSpriteMap] = React.useState(null);

    // When the menu toggle flips, reset every tile to the newly applicable
    // default variant.
    React.useEffect(() => {
        setActiveItem(computeDefaultItem());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maxMasterworkDefault]);

    function spanClicked(event) {
        let masterworkClicked = Number(event.target.id.split('-')[1]);
        const tempActiveItem = getItemWithMasterwork(item, masterworkClicked, data.itemData, data.name);
        setActiveItem(tempActiveItem);
        if (data.update) {
            data.update(tempActiveItem, tempActiveItem.type);
        }
    }

    const star1 = React.useRef();
    const star2 = React.useRef();
    const star3 = React.useRef();
    const star4 = React.useRef();
    const [starsAnimated, setStarsAnimated] = React.useState(false);

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
        // Prefer the explicit mapping generated from the texture pack.
        const mappedClass = getMappedSpriteClass(spriteMap, activeItem.name);
        if (mappedClass) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(mappedClass);
        } else if (!spriteMap) {
            // While the sprite map is still loading, fall back to the legacy class-name heuristic.
            setBaseBackgroundClass('monumenta-items');
            setCssClass(getItemsheetClass(activeItem.name));
        } else {
            // Otherwise, default to a minecraft texture.
            setBaseBackgroundClass('minecraft');
            setCssClass(`minecraft-${getMinecraftTextureKey(activeItem['base_item'])}`);
        }

        const stars = [star1, star2, star3, star4];
        const starIntervals = ['', '', '', ''];

        if (activeItem.name.includes('EX ') && !starsAnimated) {
            let index = 0;
            let interval = 2000;
            for (let i = 0; i < stars.length; i++) {
                setTimeout(
                    () => {
                        animate(stars[i], i, starIntervals);
                        starIntervals[i] = setInterval(() => {
                            animate(stars[i], i, starIntervals);
                        }, interval);
                    },
                    index++ * (interval / 4)
                );
            }

            setStarsAnimated(true);
        }
    }, [activeItem, spriteMap, starsAnimated]);

    return (
        <div className={`${styles.itemTile} ${data.hidden ? styles.hidden : ''}`}>
            {buildListEnabled && data.showListButton && (
                <button
                    type="button"
                    className={`${styles.listAddButton}${listItems.includes(data.name) ? ` ${styles.listAddButtonOn}` : ''}`}
                    onClick={() => toggleItem(data.name, item[0]?.type)}
                    aria-label={
                        listItems.includes(data.name)
                            ? `Remove ${data.name} from build list`
                            : `Add ${data.name} to build list`
                    }
                >
                    {listItems.includes(data.name) ? '✓' : '+'}
                </button>
            )}
            {enabled && data.showFavouriteButton && (
                <button
                    type="button"
                    className={`${styles.favouriteButton}${favouriteSet.has(data.name) ? ` ${styles.favouriteButtonOn}` : ''}`}
                    onClick={() =>
                        authenticated
                            ? toggleFavourite(data.name)
                            : (window.location.href = `/api/auth/discord/login?next=${encodeURIComponent(
                                  window.location.pathname + window.location.search
                              )}`)
                    }
                    aria-label={
                        favouriteSet.has(data.name)
                            ? `Remove ${data.name} from favourites`
                            : authenticated
                              ? `Add ${data.name} to favourites`
                              : 'Log in to favourite'
                    }
                    title={favouriteSet.has(data.name) ? 'Remove from favourites' : 'Add to favourites'}
                >
                    <svg viewBox="0 0 512 512" width="15" height="15" aria-hidden="true">
                        <path
                            fill={favouriteSet.has(data.name) ? 'currentColor' : 'none'}
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
                className={`${styles[camelCase(activeItem.location)]} ${styles[camelCase(activeItem.tier)]} ${styles.name}`}
            >
                {activeItem.name.includes('EX ') ? (
                    <span className={styles.exalted}>
                        <span className={styles['exalted-star']} ref={star1}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                                {/*! Font Awesome Pro 6.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc.*/}
                                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
                            </svg>
                        </span>
                        <span className={styles['exalted-star']} ref={star2}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                                {/*! Font Awesome Pro 6.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc.*/}
                                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
                            </svg>
                        </span>
                        <span className={styles['exalted-star']} ref={star3}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                                {/*! Font Awesome Pro 6.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc.*/}
                                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
                            </svg>
                        </span>
                        <span className={styles['exalted-star']} ref={star4}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                                {/*! Font Awesome Pro 6.3.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc.*/}
                                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
                            </svg>
                        </span>
                        <span className={styles['exalted-text']}>EX</span>
                    </span>
                ) : (
                    ''
                )}
                <a
                    href={`https://monumenta.wiki.gg/wiki/${activeItem.name
                        .replace(/\(.*\)/g, '')
                        .trim()
                        .replaceAll(' ', '_')}`}
                    target="_blank"
                    rel="noreferrer"
                >
                    {activeItem.name.replace('EX ', '')}
                </a>
            </span>
            <span className={styles.infoText}>
                <TranslatableText
                    identifier={`items.type.${camelCase(activeItem.type.replace('<M>', ''))}`}
                ></TranslatableText>
                {` - ${activeItem['base_item']} `}
            </span>
            {activeItem['original_item'] ? (
                <span className={styles.infoText}>{`Skin for ${activeItem['original_item']} `}</span>
            ) : (
                ''
            )}
            <span className={styles.infoText}>
                <span onClick={spanClicked} id="mw-0" className={styles['starSpan']}>
                    Masterwork
                </span>
                :{' '}
                <span>
                    {[...Array(maxMasterwork[activeItem.tier]).keys()]
                        .map((num) => num + 1)
                        .map((num) => {
                            if (num <= activeItem.masterwork) {
                                return (
                                    <span
                                        key={`mw-${num}`}
                                        onClick={spanClicked}
                                        id={`mw-${num}`}
                                        className={[styles['starSpan'], styles['masterworkStar']].join(' ')}
                                    >
                                        ★
                                    </span>
                                );
                            } else {
                                return (
                                    <span
                                        key={`mw-${num}`}
                                        onClick={spanClicked}
                                        id={`mw-${num}`}
                                        className={styles['starSpan']}
                                    >
                                        ☆
                                    </span>
                                );
                            }
                        })}
                </span>
            </span>
            {activeItem.undiscovered ? (
                activeItem.undiscovered == undiscovered.UNDISCOVERED ? (
                    <span className={styles['undiscovered']}>
                        This item has not yet been discovered! Tag jkitter on discord with a screenshot of the item.
                    </span>
                ) : activeItem.undiscovered == undiscovered.DOES_NOT_EXIST ? (
                    <span className={styles['undiscovered']}>
                        This item does not appear ingame with this level of masterwork, or this level of masterwork does
                        not have the desired stat.
                    </span>
                ) : (
                    ''
                )
            ) : (
                <div>
                    <Enchants item={activeItem}></Enchants>
                    <span>
                        <span className={styles.infoText}>{`${activeItem.region} `}</span>
                        <span className={styles[camelCase(activeItem.tier)]}>{activeItem.tier}</span>
                    </span>
                </div>
            )}
            <span className={styles[camelCase(activeItem.location)]}>{activeItem.location}</span>
            {!activeItem.undiscovered ? (
                <div>
                    {activeItem.lore ? (
                        <LoreText text={activeItem.lore} className={styles.infoText} questOnly={hideLore} />
                    ) : (
                        ''
                    )}
                    {!hideObtainment && activeItem.extras?.poi ? (
                        <p className={`${styles.infoText} m-0`}>{`Found in ${activeItem.extras.poi}`}</p>
                    ) : (
                        ''
                    )}
                    {!hideObtainment && activeItem.extras?.notes ? (
                        <p className={`${styles.infoText} m-0`}>{activeItem.extras.notes}</p>
                    ) : (
                        ''
                    )}
                </div>
            ) : (
                ''
            )}
        </div>
    );
}
