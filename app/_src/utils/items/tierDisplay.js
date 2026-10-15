// Some tier values come from the API as identifiers rather than display text
// ("Event_currency"). Only the wording changes here: the item data, filters,
// sorting, CSS classes and sprite lookups all keep the raw value.
const TIER_NAMES = {
    Event_currency: 'Event Currency',
};

export function displayTier(tier) {
    if (!tier) return tier;
    return TIER_NAMES[tier] || tier;
}
