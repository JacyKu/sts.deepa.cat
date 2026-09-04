import styles from '../../styles/Items.module.css';
import CharmFormatter from '../../utils/items/charmFormatter';
import TranslatableText from '../translatableText';
import React from 'react';
import { useLowResource } from '../lowResourceContext';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';
import { useHideObtainment } from './hideObtainmentContext';
import { useItemFavourites } from './itemFavouritesContext';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';

function camelCase(str) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function makePowerString(power) {
    return (
        <span>
            Charm Power: <span className={styles.masterworkStar}>{'★'.repeat(power)}</span>
        </span>
    );
}

function makeClassString(className) {
    return <span className={styles[className.toLowerCase()]}>{className}</span>;
}

function getImageName(charmTier, charmClass, charmPower) {
    if (charmTier == 'Epic') {
        return `Epic-Charm-${charmPower}`;
    }
    return `${charmClass == 'Alchemist' ? 'Alch' : charmClass == 'Generalist' ? 'Gen' : charmClass}-Charm${charmTier == 'Base' ? '' : `-${charmTier}`}-${charmPower}`;
}

function getCharmSheetClass(charmName) {
    return `monumenta-${charmName.replaceAll(' ', '-').replaceAll('_', '-').replaceAll("'", '').trim()}`;
}

function doesStyleExist(className) {
    let styleSheets;
    try {
        styleSheets = document.styleSheets;
    } catch (e) {
        return false;
    }

    for (let i = 0; i < styleSheets.length; i++) {
        let rules;
        try {
            rules = styleSheets[i].cssRules;
        } catch (e) {
            // Cross-origin stylesheets (e.g., CDN bootstrap) throw on cssRules.
            continue;
        }

        if (!rules) {
            continue;
        }

        for (let x = 0; x < rules.length; x++) {
            if (rules[x].selectorText == `.${className}`) {
                return true;
            }
        }
    }
    return false;
}

function CharmTile(data) {
    const item = data.item;
    const [cssClass, setCssClass] = React.useState(getCharmSheetClass(item.name));
    const [baseBackgroundClass, setBaseBackgroundClass] = React.useState('monumenta-charms');
    const [spriteMap, setSpriteMap] = React.useState(null);
    const { lowRes } = useLowResource();
    const { hidden: hideObtainment } = useHideObtainment();
    const { items: listItems, toggleItem } = useBuildList();
    const { enabled: buildListEnabled } = useBuildListEnabled();
    const { favouriteSet, authenticated, enabled, toggle: toggleFavourite } = useItemFavourites();

    let formattedCharm = CharmFormatter.formatCharm(item.stats);

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
        const mappedClass = getMappedSpriteClass(spriteMap, item.name);
        if (mappedClass && doesStyleExist(mappedClass)) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(mappedClass);
            return;
        }
        if (mappedClass && !spriteMap) {
            // Map still loading (stale cache or first fetch); the class was
            // found via the already-loaded map, so use it.
            setBaseBackgroundClass('monumenta-items');
            setCssClass(mappedClass);
            return;
        }

        // The charm doesn't have its own texture on the itemsheet, and must be defaulted to the default charms.
        setBaseBackgroundClass('monumenta-charms');
        if (!doesStyleExist(getCharmSheetClass(item.name))) {
            setCssClass(`monumenta-${getImageName(item.tier, item.class_name, item.power)}`);
        } else {
            setCssClass(getCharmSheetClass(item.name));
        }
    }, [item.name, item.tier, item.class_name, item.power, spriteMap]);

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
            {enabled && data.showFavouriteButton && (
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
            <span className={`${styles[camelCase(item.location)]} ${styles[camelCase(item.tier)]} ${styles.name}`}>
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
                <TranslatableText identifier="items.type.charm"></TranslatableText>
            </span>
            {item['original_item'] ? (
                <span className={styles.infoText}>{`Skin for ${item['original_item']} `}</span>
            ) : (
                ''
            )}
            <span className={styles.infoText}>
                {makePowerString(item.power)} - {makeClassString(item.class_name)}
            </span>
            {formattedCharm}
            <span>
                <span className={styles.infoText}>{`${item.region} `}</span>
                <span className={styles[camelCase(item.tier)]}>{item.tier != 'Base' ? `${item.tier} ` : ''}Charm</span>
            </span>
            <span className={styles[camelCase(item.location)]}>{item.location}</span>
            {!hideObtainment && (
                <>
                    {item.extras?.poi ? (
                        <p className={`${styles.infoText} m-0`}>{`Found in ${item.extras.poi}`}</p>
                    ) : (
                        ''
                    )}
                    {item.extras?.notes ? <p className={`${styles.infoText} m-0`}>{`${item.extras.notes}`}</p> : ''}
                </>
            )}
        </div>
    );
}

export default React.memo(CharmTile);
