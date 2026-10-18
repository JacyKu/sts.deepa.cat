// Potions/food selected in the builder's "Potion effects" panel. They are a
// stat preview (like the extra multipliers), not part of the saved build, so
// they live in this browser rather than in the build token.
const BUILDER_POTIONS_KEY = 'sts.builderPotions';
const BUILDER_POTIONS_ENABLED_KEY = 'sts.builderPotionsEnabled';

export function getBuilderPotions() {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(BUILDER_POTIONS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : [];
    } catch (e) {
        return [];
    }
}

export function setBuilderPotions(names) {
    try {
        window.localStorage.setItem(BUILDER_POTIONS_KEY, JSON.stringify(Array.isArray(names) ? names : []));
    } catch (e) {
        // storage unavailable; the selection still works for this page
    }
}

// Whether the potions picked in the builder count towards the stats. On by
// default; the toggle before the picker turns the whole preview off without
// forgetting the selection.
export function isBuilderPotionsEnabled() {
    if (typeof window === 'undefined') return true;
    try {
        const stored = window.localStorage.getItem(BUILDER_POTIONS_ENABLED_KEY);
        return stored === null ? true : stored === 'true';
    } catch (e) {
        return true;
    }
}

export function setBuilderPotionsEnabled(enabled) {
    try {
        window.localStorage.setItem(BUILDER_POTIONS_ENABLED_KEY, String(Boolean(enabled)));
    } catch (e) {
        // storage unavailable; the toggle still works for this page
    }
}

// The hidden form field's value: the picked potions while the preview is on,
// an empty list while it is off (the picks are kept, not cleared).
export function builderPotionsValue() {
    return isBuilderPotionsEnabled() ? JSON.stringify(getBuilderPotions()) : '[]';
}
