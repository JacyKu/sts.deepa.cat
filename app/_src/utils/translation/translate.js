import SupportedLanguages from './languages';

// Look up a translation id for a language, falling back to English (and then
// the id itself) so a missing translation never surfaces as a raw key.
export function translate(lang, id) {
    const table = SupportedLanguages[lang];
    if (table && table[id] != null) return table[id];
    const en = SupportedLanguages.en;
    return en && en[id] != null ? en[id] : id;
}
