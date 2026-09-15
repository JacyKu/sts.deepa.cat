'use client';

import React from 'react';
import { useLanguageContext } from './languageContext';
import { translate } from '../utils/translation/translate';

// Shared translator hook: `const t = useTranslation(); t('some.key')`.
// Falls back to English (then the key) when the current language lacks it.
export function useTranslation() {
    const { lang } = useLanguageContext();
    return React.useCallback((id) => translate(lang, id), [lang]);
}
