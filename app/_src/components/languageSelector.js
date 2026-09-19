import SupportedLanguages from '../utils/translation/languages';
import Select from 'react-select';
import { setCookie, getCookie } from 'cookies-next';
import { useLanguageContext } from '../components/languageContext';
import React from 'react';

const languageNames = {
    en: 'English',
    it: 'Italiano',
    zh_tw: '繁體中文',
    zh_cn: '简体中文',
    hu: 'Magyar',
    ru: 'русский',
    fr: 'Français',
};

function LanguageSelector({ className, compact } = {}) {
    const options = Object.keys(SupportedLanguages).map((lang) => {
        return { value: lang, label: languageNames[lang] };
    });
    const { lang, setLang } = useLanguageContext();
    // The control box is square-ish by default; `compact` sizes it to match
    // neighbouring footer buttons (same 36px height as .link/.textLink).
    const controlHeight = compact ? 36 : 44;

    function langSelected(lang) {
        setCookie('lang', lang.value);
        setLang(lang.value);
    }

    React.useEffect(() => {
        let cookieLang = getCookie('lang');
        cookieLang = cookieLang ? cookieLang : 'en';
        setLang(cookieLang);
    }, [setLang]);

    return (
        <div className={className}>
            <Select
                key={lang}
                instanceId={lang}
                name="languageSelect"
                options={options}
                onChange={langSelected}
                defaultValue={options.find((opt) => opt.value == lang)}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                theme={(theme) => ({
                    ...theme,
                    borderRadius: 0,
                    colors: {
                        ...theme.colors,
                        primary: 'var(--text-1)',
                        primary25: 'var(--surface-2)',
                        neutral0: 'var(--glass-menu)',
                        neutral5: 'var(--glass-2)',
                        neutral10: 'var(--glass-2)',
                        neutral20: 'var(--control-border)',
                        neutral30: 'var(--control-border-hover)',
                        neutral60: 'var(--text-2)',
                        neutral80: 'var(--text-1)',
                    },
                })}
                styles={{
                    container: (base) => ({ ...base, width: '100%' }),
                    control: (base) => ({ ...base, minHeight: controlHeight, height: controlHeight }),
                    valueContainer: (base) => ({ ...base, minHeight: controlHeight, paddingTop: 0, paddingBottom: 0 }),
                    indicatorsContainer: (base) => ({ ...base, height: controlHeight }),
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    menu: (base) => ({ ...base, zIndex: 9999 }),
                }}
            />
        </div>
    );
}

export default LanguageSelector;
