import locationData from '../../data/locations.json';

// Location display name -> registry id, from the API's /locations registry
// (scripts/update-locations.mjs) plus any hand-added entries.
const ID_BY_NAME = { ...(locationData.locations || {}), ...(locationData.manual || {}) };

// The registry id behind an item's location: the item's own field when the data
// carries it, otherwise the registry map. Null when neither knows it.
export function locationId(item) {
    if (!item) return null;
    return item.locationId || ID_BY_NAME[item.location] || null;
}

// The location text to render: with the setting on, the registry id is added
// behind the name ("Salazar's Folly (lime)"), matching how the Location filter
// lists them. Locations the registry does not list (the region names, and event
// locations like Tenyears) keep the name alone either way.
export function locationText(item, useIds) {
    if (!item) return '';
    const name = item.location || '';
    if (!useIds) return name;
    const id = locationId(item);
    return id ? `${name} (${id})` : name;
}
