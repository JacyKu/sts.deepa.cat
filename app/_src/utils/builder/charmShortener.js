class CharmShortener {
    static extractRelevantLetters(charmName, n) {
        let parts = [];
        parts.push(charmName.substring(0, 3));
        if (charmName.length - 3 < n) {
            parts.push(charmName.substring(3));
        } else {
            parts.push(charmName.substring(charmName.length - n));
        }
        return parts;
    }

    static shortenCharmList(charmList) {
        return charmList
            .map((charm) => ({
                name: this.extractRelevantLetters(charm.name.replace(' Charm', ''), 6),
                power: charm.power,
                class: charm.class_name,
            }))
            .map(
                (charm) =>
                    `${charm.name[0].replaceAll(' ', '_')}-${charm.name[1].replaceAll(' ', '_')}-${charm.power}-${charm.class[0]}`
            )
            .join(',');
    }

    static parseCharmData(charmData, itemData) {
        if (typeof charmData !== 'string' || charmData == 'None') {
            return [];
        }

        let charms = charmData
            .split(',')
            .map((charmString) => charmString.split('-'))
            // Hand-made/legacy tokens can carry malformed entries (no dashes,
            // missing fields); skip them instead of crashing the builder.
            .filter((charmParts) => charmParts.length >= 4 && charmParts[3])
            .map((charmParts) => ({
                prefix: charmParts[0].replaceAll('_', ' '),
                suffix: charmParts[1].replaceAll('_', ' '),
                power: Number(charmParts[2]),
                classLetter: charmParts[3],
            }));

        let foundCharms = [];
        charms.forEach((charm) => {
            let foundCharm = Object.keys(itemData).find(
                (name) =>
                    itemData[name].type == 'Charm' &&
                    itemData[name].name.substring(0, 3) == charm.prefix &&
                    itemData[name].name.includes(charm.suffix) &&
                    itemData[name].power == charm.power &&
                    itemData[name].class_name?.[0] == charm.classLetter
            );
            if (foundCharm) {
                foundCharms.push(foundCharm);
            }
        });
        return foundCharms;
    }
}

export default CharmShortener;
