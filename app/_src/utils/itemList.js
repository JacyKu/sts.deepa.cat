// Item list helpers shared by the items page and the coverage/landing page,
// so every item count on the site is computed the same way.

// Groups masterwork tiers of the same item into a single entry, mutating
// `items` (an array of itemData keys) exactly as the items page renders
// them: each masterwork family becomes one entry, placed at the position of
// its lowest tier, other levels removed.
export function groupMasterworkItems(items, itemData) {
    let masterworkItems = {};
    let otherPositionsToRemove = [];
    // Go through the array in reverse order to have the splice work properly
    // (items will go down in position if not removed from the end).
    for (let i = items.length - 1; i >= 0; i--) {
        let name = items[i];
        if (itemData[name].masterwork != undefined) {
            let itemName = itemData[name].name;
            if (!masterworkItems[itemName]) {
                masterworkItems[itemName] = { items: [], lowestPosition: 9999999, lowestPositionName: null };
            }
            masterworkItems[itemName].items.push(itemData[name]);
            if (i < masterworkItems[itemName].lowestPosition) {
                // Remove the old lowest position item.
                if (masterworkItems[itemName].lowestPosition < 9999999) {
                    otherPositionsToRemove.push(masterworkItems[itemName].lowestPosition);
                }
                masterworkItems[itemName].lowestPosition = i;
                masterworkItems[itemName].lowestPositionName = name;
            } else {
                otherPositionsToRemove.push(i);
            }
        }
    }

    otherPositionsToRemove = otherPositionsToRemove.sort((pos1, pos2) => pos2 - pos1);
    for (const pos of otherPositionsToRemove) {
        items.splice(pos, 1);
    }

    // Re-insert the groups as arrays into the items array, IN THE CORRECT POSITION.
    let masterworkGroups = Object.keys(masterworkItems).sort(
        (item1, item2) => masterworkItems[item2].lowestPosition - masterworkItems[item1].lowestPosition
    );
    for (const masterworkGroup of masterworkGroups) {
        items.splice(
            items.indexOf(masterworkItems[masterworkGroup].lowestPositionName),
            1,
            masterworkItems[masterworkGroup].items
        );
    }

    return items;
}

// Count of display entries, mirroring the items page's default list: Written
// Books are hidden and each masterwork family counts as one item.
export function countDisplayItems(itemData) {
    const families = new Set();
    let plain = 0;
    for (const key of Object.keys(itemData)) {
        const item = itemData[key];
        if (item.base_item === 'Written Book') continue;
        if (item.masterwork != undefined) {
            families.add(item.name);
        } else {
            plain++;
        }
    }
    return plain + families.size;
}
