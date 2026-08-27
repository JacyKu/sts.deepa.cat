import styles from '../../styles/Items.module.css';
import Enchants from './enchants';
import LoreText from './loreText';
import ConsumableFormatter from '../../utils/items/consumableFormatter';
import TranslatableText from '../translatableText';
import React from 'react';
import { loadItemSpriteMap, getMappedSpriteClass } from '../../utils/items/spritesheetMap';
import { useHideLore } from './hideLoreContext';
import { useHideObtainment } from './hideObtainmentContext';
import { useBuildList } from './buildListContext';
import { useBuildListEnabled } from './buildListEnabledContext';

const MAX_FISH_QUALITY = 5;

function camelCase(str) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 ? word.toLowerCase() : word.toUpperCase();
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
    return `monumenta-${itemName
        .replace(/^EX\s+/, '') // EX items share the base item's texture
        .replace(/\(.*\)/g, '')
        .replaceAll(' ', '-')
        .replaceAll('_', '-')
        .replaceAll("'", '')
        .trim()}`;
}

function getFishQualityElement(fishQuality) {
    return (
        <span>
            <span>Fish Quality : </span>
            <span className={styles[`fish${fishQuality}`]}>
                {'★'.repeat(fishQuality) + '☆'.repeat(MAX_FISH_QUALITY - fishQuality)}
            </span>
        </span>
    );
}

export default function ConsumableTile(data) {
    const item = data.item;
    const { hidden: hideLore } = useHideLore();
    const { hidden: hideObtainment } = useHideObtainment();
    const { items: listItems, toggleItem } = useBuildList();
    const { enabled: buildListEnabled } = useBuildListEnabled();
    let formattedEffects = ConsumableFormatter.formatEffects(item.effects);

    const [cssClass, setCssClass] = React.useState(getItemsheetClass(item.name));
    const [baseBackgroundClass, setBaseBackgroundClass] = React.useState('monumenta-items');
    const [spriteMap, setSpriteMap] = React.useState(null);

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
        const mappedClass = getMappedSpriteClass(spriteMap, item.name);
        if (mappedClass) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(mappedClass);
            return;
        }

        if (!spriteMap) {
            setBaseBackgroundClass('monumenta-items');
            setCssClass(getItemsheetClass(item.name));
            return;
        }

        // The consumable doesn't have its own texture on the spritesheet, and must be defaulted to a minecraft texture.
        setBaseBackgroundClass('minecraft');
        setCssClass(`minecraft-${item['base_item'].replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`);
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
            <div className={styles.imageIcon}>
                <div className={[baseBackgroundClass, cssClass].join(' ')}></div>
            </div>
            <span className={`${styles[camelCase(item.location)]} ${styles[camelCase(item.tier)]} ${styles.name}`}>
                <a
                    href={`https://monumenta.wiki.gg/wiki/${item.name
                        .replace(/\(.*\)/g, '')
                        .trim()
                        .replaceAll(' ', '_')}`}
                    target="_blank"
                    rel="noreferrer"
                    className={item.fish_quality == 5 ? styles['underline'] : ''}
                >
                    {item.name}
                </a>
            </span>
            {item.fish_quality ? getFishQualityElement(item.fish_quality) : ''}
            <span className={styles.infoText}>
                <TranslatableText identifier={`items.type.${getItemType(item)}`}></TranslatableText>
                {` - ${item['base_item']} `}
            </span>
            {item['original_item'] ? (
                <span className={styles.infoText}>{`Skin for ${item['original_item']} `}</span>
            ) : (
                ''
            )}
            <span>
                <span className={styles.infoText}>{`${item.region ? item.region : ''} `}</span>
                <span className={styles[camelCase(item.tier)]}>{item.tier ? item.tier : 'Consumable'}</span>
            </span>
            <span className={styles[camelCase(item.location)]}>{item.location}</span>
            {formattedEffects}
            <Enchants item={item}></Enchants>
            {item.lore ? <LoreText text={item.lore} className={styles.infoText} questOnly={hideLore} /> : ''}
            {!hideObtainment && (
                <>
                    {item.extras?.poi ? <p className={`${styles.infoText} m-0`}>{`Found in ${item.extras.poi}`}</p> : ''}
                    {item.extras?.notes ? <p className={`${styles.infoText} m-0`}>{item.extras.notes}</p> : ''}
                </>
            )}
        </div>
    );
}
