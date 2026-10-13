// Locale tables. English is bundled (every lookup falls back to it); the other
// locales are loaded on demand, so their JSON stays out of the initial bundle
// until the visitor actually switches to them.
import en from './languages/en.json';

// All selectable languages. Kept static (with the name each is shown under) so
// the language selector can list every language without loading its table.
export const LANGUAGE_CODES = ['en', 'it', 'zh_tw', 'zh_cn', 'hu', 'ru', 'fr'];

const tables = { en };

const loaders = {
    it: () => import('./languages/it.json'),
    zh_tw: () => import('./languages/zh_tw.json'),
    zh_cn: () => import('./languages/zh_cn.json'),
    hu: () => import('./languages/hu.json'),
    ru: () => import('./languages/ru.json'),
    fr: () => import('./languages/fr.json'),
};

const pending = {};

// Synchronous lookup used while rendering: the loaded locale, or English until
// the requested locale's chunk has arrived (the language provider loads it
// before switching, so a rendered non-English language always has its table).
export function getLanguageTable(lang) {
    return tables[lang] || tables.en;
}

export function isLanguageLoaded(lang) {
    return Boolean(tables[lang]);
}

// Loads and caches a locale table. Safe to call repeatedly; concurrent calls
// share a single import.
export function loadLanguage(lang) {
    if (tables[lang]) return Promise.resolve(tables[lang]);
    const loader = loaders[lang];
    if (!loader) return Promise.resolve(tables.en);
    if (!pending[lang]) {
        pending[lang] = loader()
            .then((mod) => {
                tables[lang] = mod && mod.default ? mod.default : mod;
                return tables[lang];
            })
            .catch(() => tables.en);
    }
    return pending[lang];
}
