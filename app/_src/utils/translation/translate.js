import { getLanguageTable } from './languages';

// Look up a translation id for a language, falling back to English (and then
// the id itself) so a missing translation never surfaces as a raw key. Only
// English is bundled; other locales resolve once their chunk has loaded.
export function translate(lang, id) {
    const table = getLanguageTable(lang);
    if (table[id] != null) return table[id];
    const en = getLanguageTable('en');
    return en[id] != null ? en[id] : id;
}
