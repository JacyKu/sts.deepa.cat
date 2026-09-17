import styles from '../../styles/Items.module.css';
import CharmFormatter from '../../utils/items/charmFormatter';
import ItemHistoryPanel from './itemHistoryPanel';
import TranslatableText from '../translatableText';
import React from 'react';
import { useLowResource } from '../lowResourceContext';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';
import { useHideObtainment } from './hideObtainmentContext';
import { useItemFavourites } from './itemFavouritesContext';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';
import { useInView } from '../inView';
import { useTranslation } from '../useTranslation';

function camelCase(str) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function makePowerString(power, t) {
    return (
        <span>
            {t('items.searchForm.charmPower')}: <span className={styles.masterworkStar}>{'★'.repeat(power)}</span>
        </span>
    );
}

function makeClassString(className) {
    // Custom charm items have no class; leave the class label out then.
    if (!className) return null;
    return <span className={styles[className.toLowerCase()]}>{className}</span>;
}

function getImageName(charmTier, charmClass, charmPower) {
    // Custom charm items have no class: fall back to the plain charm sprite.
    const cls = charmClass || 'Generalist';
    if (charmTier == 'Epic') {
        return `Epic-Charm-${charmPower}`;
    }
    return `${cls == 'Alchemist' ? 'Alch' : cls == 'Generalist' ? 'Gen' : cls}-Charm${charmTier == 'Base' ? '' : `-${charmTier}`}-${charmPower}`;
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
    const t = useTranslation();
    const [cssClass, setCssClass] = React.useState(getCharmSheetClass(item.name));
    const [baseBackgroundClass, setBaseBackgroundClass] = React.useState('monumenta-charms');
    const [spriteMap, setSpriteMap] = React.useState(null);
    const { ref, inView, minHeight } = useInView(null);
    const { lowRes } = useLowResource();
    const { hidden: hideObtainment } = useHideObtainment();
    const { items: listItems, toggleItem } = useBuildList();
    const { enabled: buildListEnabled } = useBuildListEnabled();
    const { favouriteSet, authenticated, enabled, toggle: toggleFavourite } = useItemFavourites();

    let formattedCharm = CharmFormatter.formatCharm(item.stats, item.statColors);

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

    if (!inView) {
        return (
            <div ref={ref} className={`${styles.itemTile} ${data.hidden ? styles.hidden : ''}`} style={{ minHeight }} />
        );
    }

    return (
        <div ref={ref} className={`${styles.itemTile} ${data.hidden ? styles.hidden : ''}`}>
            {buildListEnabled && data.showListButton && (
                <button
                    type="button"
                    className={`${styles.listAddButton}${listItems.includes(item.name) ? ` ${styles.listAddButtonOn}` : ''}`}
                    onClick={() => toggleItem(item.name, item.type)}
                    aria-label={
                        listItems.includes(item.name)
                            ? `${t('common.remove')} ${item.name} ${t('items.buildList.fromBuildList')}`
                            : `${t('common.add')} ${item.name} ${t('items.buildList.toBuildList')}`
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
                            ? `${t('common.remove')} ${item.name} ${t('items.favourite.fromFavourites')}`
                            : authenticated
                              ? `${t('common.add')} ${item.name} ${t('items.favourite.toFavourites')}`
                              : t('items.favourite.login')
                    }
                    title={
                        favouriteSet.has(item.name)
                            ? `${t('common.remove')} ${t('items.favourite.fromFavourites')}`
                            : `${t('common.add')} ${t('items.favourite.toFavourites')}`
                    }
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
                <span className={styles.infoText}>{`${t('items.skinFor')} ${item['original_item']} `}</span>
            ) : (
                ''
            )}
            <span className={styles.infoText}>
                {makePowerString(item.power, t)}
                {/* Custom charm items carry no class; drop the label then. */}
                {item.class_name && <> - {makeClassString(item.class_name)}</>}
            </span>
            {formattedCharm}
            <span>
                {item.region && <span className={styles.infoText}>{`${item.region} `}</span>}
                <span className={styles[camelCase(item.tier)]}>
                    {item.tier && item.tier != 'Base' ? `${item.tier} ` : ''}
                    {t('items.type.charm')}
                </span>
            </span>
            {item.location && <span className={styles[camelCase(item.location)]}>{item.location}</span>}
            {!hideObtainment && (
                <>
                    {item.extras?.poi ? (
                        <p className={`${styles.infoText} m-0`}>{`${t('items.foundIn')} ${item.extras.poi}`}</p>
                    ) : (
                        ''
                    )}
                    {item.extras?.notes ? <p className={`${styles.infoText} m-0`}>{`${item.extras.notes}`}</p> : ''}
                </>
            )}
            <ItemHistoryPanel records={data.history} currentItem={item} />
        </div>
    );
}

export default React.memo(CharmTile);
