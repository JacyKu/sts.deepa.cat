// Profanity filter for build names/notes. The word list is deliberately
// small (slurs only) so ordinary build names - skills, items, places - never
// trip it.
//
// Detection runs on a normalized copy of the text so common bypasses stop
// working:
//   - leetspeak / lookalike characters ("n1gger", "f4gg0t", Cyrillic "і")
//   - invisible characters (zero-width separators, combining accents)
//   - separator characters between letters ("n.i.g.g.e.r", "n i g g e r")
//   - extra repeated letters ("niiggger")
//
// Two guards keep normal words safe:
//   - a leading word boundary, so words that merely contain a stem
//     ("snigger", "Scunthorpe") are left alone
//   - every stem letter must appear at least as often as in the stem, so
//     "Niger"/"Nigeria" (one g) do not match "nigger" (two g's)
const BAD_WORD_STEMS = ['faggot', 'nigger', 'nigga', 'tranny'];

// Leetspeak, lookalike symbols, and Cyrillic/Greek homoglyphs.
const CHAR_MAP = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '6': 'g',
    '7': 't',
    '8': 'b',
    '9': 'g',
    '@': 'a',
    $: 's',
    '!': 'i',
    '|': 'i',
    '+': 't',
    '\u0430': 'a',
    '\u0435': 'e',
    '\u043e': 'o',
    '\u0440': 'p',
    '\u0441': 'c',
    '\u0443': 'y',
    '\u0445': 'x',
    '\u0456': 'i',
    '\u0455': 's',
    '\u04bb': 'h',
    '\u03b1': 'a',
    '\u03b5': 'e',
    '\u03bf': 'o',
    '\u03c1': 'p',
    '\u03c5': 'y',
    '\u03b9': 'i',
};

// Anything that is not a plain letter/digit may sit between the letters of a
// blocked word ("n.i.g.g.e.r", "n-i-g-g-e-r", "n i g g e r").
const SEPARATORS = '[^a-z0-9]*';

function normalize(text) {
    return String(text)
        // NFKD splits accented/compatibility characters into base letters +
        // combining marks, which are stripped below ("niggé r" -> "nigger",
        // fullwidth letters -> ascii).
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
        .replace(/\p{M}/gu, '')
        .replace(/[\s\S]/g, (ch) => CHAR_MAP[ch] || ch);
}

// "nigger" -> n(?:sep n)* i(?:sep i)* g(?:sep g){1,} e(?:sep e)* r(?:sep r)*
// Each run of the same letter may repeat (and be separated by punctuation)
// but never appears fewer times than in the stem.
function stemPattern(stem) {
    const parts = [];
    for (let i = 0; i < stem.length; ) {
        let end = i;
        while (end < stem.length && stem[end] === stem[i]) end += 1;
        const letter = stem[i];
        const count = end - i;
        parts.push(`${letter}(?:${SEPARATORS}${letter}){${count - 1},}`);
        i = end;
    }
    return '\\b' + parts.join(SEPARATORS) + '[a-z0-9]*';
}

const badWordRegex = new RegExp(BAD_WORD_STEMS.map(stemPattern).join('|'), 'g');

export function filterBadWords(text) {
    if (!text) return { cleaned: text, found: false };
    const normalized = normalize(text);
    badWordRegex.lastIndex = 0;
    const found = badWordRegex.test(normalized);
    if (!found) return { cleaned: text, found: false };
    // Blocked text is returned normalized and stripped of the match, so the
    // bypass characters go away with the word.
    badWordRegex.lastIndex = 0;
    const cleaned = normalized.replace(badWordRegex, ' ').replace(/\s{2,}/g, ' ').trim();
    return { cleaned, found };
}
