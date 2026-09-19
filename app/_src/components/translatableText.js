import React from 'react';
import { useLanguageContext } from '../components/languageContext';
import { translate } from '../utils/translation/translate';

export default function TranslatableText({ identifier, className }) {
    const { lang } = useLanguageContext();
    return (
        <span className={className} key={`${lang}-${identifier}`}>
            {translate(lang, identifier)}
        </span>
    );
}
