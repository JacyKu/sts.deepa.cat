// How normal infusion levels are entered in the builder: on each item, as a
// total per infusion (the number boxes above the multipliers), or both.
// 'both' is the builder's original behaviour. Stored per browser like the
// other site settings.
export const INFUSION_INPUT_KEY = 'sts.infusionInputs';
export const INFUSION_INPUT_MODES = ['item', 'total', 'both'];
export const DEFAULT_INFUSION_INPUT_MODE = 'both';

export function getInfusionInputMode() {
    if (typeof window === 'undefined') return DEFAULT_INFUSION_INPUT_MODE;
    try {
        const value = window.localStorage.getItem(INFUSION_INPUT_KEY);
        return INFUSION_INPUT_MODES.includes(value) ? value : DEFAULT_INFUSION_INPUT_MODE;
    } catch (e) {
        return DEFAULT_INFUSION_INPUT_MODE;
    }
}

export function setInfusionInputMode(mode) {
    try {
        if (INFUSION_INPUT_MODES.includes(mode)) window.localStorage.setItem(INFUSION_INPUT_KEY, mode);
        else window.localStorage.removeItem(INFUSION_INPUT_KEY);
    } catch (e) {
        // storage unavailable; nothing to do
    }
}
