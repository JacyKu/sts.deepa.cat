// Which skill/spec calculations the builder's experimental row has switched
// on. Every calculation starts off; the row's toggles remember the enabled ones
// per browser (like the stat-card visibility toggles remember the hidden ones).
const ENABLED_SKILL_CALCS_KEY = 'sts.enabledSkillCalcs';

export function getEnabledSkillCalcs() {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(ENABLED_SKILL_CALCS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch (e) {
        return [];
    }
}

export function setEnabledSkillCalcs(ids) {
    try {
        const clean = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
        if (clean.length === 0) window.localStorage.removeItem(ENABLED_SKILL_CALCS_KEY);
        else window.localStorage.setItem(ENABLED_SKILL_CALCS_KEY, JSON.stringify(clean));
    } catch (e) {
        // storage unavailable; the toggles still work for this page
    }
}
