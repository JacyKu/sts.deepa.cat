'use client';

import React from 'react';
import itemsStyles from '../../styles/Items.module.css';
import styles from '../../styles/History.module.css';
import { loadItemSpriteMap, getMappedSpriteClass, isKnownSpriteToken } from '../../utils/items/spritesheetMap';
import { getMinecraftTextureKey } from '../../utils/items/minecraftFallback';

function camelCase(str, upper) {
    if (!str) return '';
    return str
        .replaceAll("'", '')
        .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
            return index == 0 && !upper ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
}

function sheetClassFromName(itemName) {
    return `monumenta-${camelCase(
        itemName
            .replace(/^EX\s+/, '')
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

// Item sprite shared by the stat history page and the API changes page: same
// resolution order as the item tiles - texture token, sprite map, legacy name
// heuristic (while the map loads), then the minecraft texture. `compact`
// renders a smaller icon for dense lists.
export default function HistoryIcon({ item, compact = false }) {
    const [cssClass, setCssClass] = React.useState(item.textureToken ? `monumenta-${item.textureToken}` : null);
    const [baseClass, setBaseClass] = React.useState('monumenta-items');
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

    React.useEffect(() => {
        if (item.textureToken && (!spriteMap || isKnownSpriteToken(spriteMap, item.textureToken))) {
            setBaseClass('monumenta-items');
            setCssClass(`monumenta-${item.textureToken}`);
            return;
        }
        if (spriteMap) {
            const mapped = getMappedSpriteClass(spriteMap, item.name);
            if (mapped) {
                setBaseClass('monumenta-items');
                setCssClass(mapped);
                return;
            }
            if (item.base_item) {
                setBaseClass('minecraft');
                setCssClass(`minecraft-${getMinecraftTextureKey(item.base_item)}`);
                return;
            }
        }
        setBaseClass('monumenta-items');
        setCssClass(sheetClassFromName(item.name));
    }, [item, spriteMap]);

    return (
        <div className={compact ? styles.compactIcon : `${itemsStyles.imageIcon} ${styles.groupIcon}`}>
            <div className={[baseClass, cssClass].join(' ')}></div>
        </div>
    );
}
