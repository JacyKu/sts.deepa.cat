import Enchants from './enchants';
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
        // Prefer the explicit mapping generated from the texture pack.
        const mappedClass = getMappedSpriteClass(spriteMap, item.name);
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
            {item.lore && !hideLore ? <span className={styles.infoText}>{item.lore}</span> : ''}
            {!hideObtainment && (
                <>
                    {item.extras?.poi ? <p className={`${styles.infoText} m-0`}>{`Found in ${item.extras.poi}`}</p> : ''}
                    {item.extras?.notes ? <p className={`${styles.infoText} m-0`}>{item.extras.notes}</p> : ''}
                </>
            )}
        </div>
    );
}
