'use client';

import React from 'react';
import { getCookie } from 'cookies-next';
import { loadLanguage } from '../utils/translation/languages';

export const LanguageContext = React.createContext({
    lang: 'en',
    setLang: () => {},
});

export const LanguageContextProvider = ({ children }) => {
    const [lang, setLangState] = React.useState('en');
    // Monotonic id so a slow locale load can't override a newer selection.
    const requestRef = React.useRef(0);

    // Load the locale chunk before switching, so the page re-renders straight
    // into translated text instead of flashing English first.
    const setLang = React.useCallback((next) => {
        const target = next || 'en';
        const request = ++requestRef.current;
        loadLanguage(target).then(() => {
            if (request === requestRef.current) setLangState(target);
        });
    }, []);

    // Apply a stored language on first load. This used to live in the language
    // selector, which is now loaded on demand and would apply it too late.
    React.useEffect(() => {
        const stored = getCookie('lang');
        if (stored && stored !== 'en') setLang(stored);
    }, [setLang]);

    return (
        <LanguageContext.Provider
            value={{
                lang: lang,
                setLang: setLang,
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguageContext = () => React.useContext(LanguageContext);
