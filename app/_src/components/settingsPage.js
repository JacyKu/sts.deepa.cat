'use client';

import React from 'react';
import Select from 'react-select';
import styles from '../styles/Account.module.css';
import { FONT_ORDER, FONT_LABELS, FONT_STACKS } from './header';
import BuilderLayoutToggle from './builderLayoutToggle';
import { CacheSearchToggle, CacheBuildsToggle } from './cachingToggles';
import {
    applyThemeState,
    readThemeState,
    THEME_VALUES,
    THEME_LABELS,
    GLASS_PRIDE_SCHEMES,
    GLASS_BASIC_SCHEMES,
    GLASS_CHIPS,
    CUSTOM_SCHEME,
    MAX_GLASS_CUSTOM_COLORS,
    DEFAULT_GLASS_CUSTOM_COLORS,
    glassSchemeLabel,
    systemTheme,
} from './themeSettings';

// The font picker is a small pill select, deliberately different from the
// rectangular selects used elsewhere on the site.
const fontSelectTheme = (theme) => ({
    ...theme,
    borderRadius: 999,
    colors: {
        ...theme.colors,
        primary: 'var(--text-1)',
        primary25: 'var(--surface-2)',
        neutral0: 'var(--glass-menu)',
        neutral5: 'var(--glass-2)',
        neutral10: 'var(--glass-2)',
        neutral20: 'var(--glass-border)',
        neutral30: 'var(--glass-border)',
        neutral60: 'var(--text-2)',
        neutral80: 'var(--text-1)',
    },
});

// Builds the pill-select styles. The pill only fits the rounded look, so it
// turns square when "Round corners" is off and the rest of the site is.
const makeFontSelectStyles = (round) => ({
    control: (base) => ({
        ...base,
        minHeight: 28,
        height: 28,
        // Square when "Round corners" is off; the rounded-mode global rule
        // overrides this with its own radius when it is on.
        borderRadius: round ? 999 : 0,
        background: 'var(--surface-2)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'none',
        cursor: 'pointer',
        fontSize: '0.8rem',
    }),
    valueContainer: (base) => ({ ...base, height: 28, padding: '0 6px 0 12px' }),
    singleValue: (base) => ({ ...base, color: 'var(--text-1)' }),
    indicatorsContainer: (base) => ({ ...base, height: 28 }),
    dropdownIndicator: (base) => ({ ...base, padding: '0 8px 0 4px' }),
    indicatorSeparator: () => ({ display: 'none' }),
    menu: (base) => ({ ...base, zIndex: 9999, borderRadius: round ? 10 : 0, overflow: 'hidden' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base) => ({
        ...base,
        fontSize: '0.85rem',
        padding: '5px 12px',
        cursor: 'pointer',
    }),
    menuList: (base) => ({ ...base, padding: '4px' }),
});

// Visual swatch for each theme card. Inline layered backgrounds keep the
// previews self-contained; text-on-accent/borders come from real vars so
// the swatch echoes the theme's actual colours.
const THEME_SWATCHES = {
    dark: 'linear-gradient(160deg, #2a2a30 0%, #101014 45%, #000 100%)',
    light: 'linear-gradient(160deg, #ffffff 0%, #e2e2e6 55%, #c2c3ca 100%)',
    glass: 'radial-gradient(circle at 25% 30%, rgba(252, 244, 49, 0.55) 0%, transparent 55%), radial-gradient(circle at 75% 70%, rgba(156, 89, 209, 0.6) 0%, transparent 55%), linear-gradient(160deg, #1b2540 0%, #0d1226 60%, #070a12 100%)',
    'glass-light':
        'radial-gradient(circle at 25% 30%, rgba(252, 244, 49, 0.5) 0%, transparent 55%), radial-gradient(circle at 75% 70%, rgba(156, 89, 209, 0.5) 0%, transparent 55%), linear-gradient(160deg, #ffffff 0%, #e7ecf7 60%, #cdd6ec 100%)',
};

// Site-wide look and behaviour settings. Available to everyone, logged in or
// not; everything is stored in the browser.
export default function SettingsPage() {
    const [themeState, setThemeState] = React.useState(null);
    const [font, setFont] = React.useState('ubuntu');

    React.useEffect(() => {
        setThemeState(readThemeState());
        // Persist nothing here; that happens on first explicit choice.
    }, []);

    React.useEffect(() => {
        const current = document.documentElement.dataset.font;
        if (FONT_ORDER.includes(current)) {
            setFont(current);
            return;
        }
        try {
            const stored = localStorage.getItem('font');
            if (FONT_ORDER.includes(stored)) {
                document.documentElement.dataset.font = stored;
                setFont(stored);
            }
        } catch (e) {
            // ignore
        }
    }, []);

    const fontOptions = FONT_ORDER.map((value) => ({
        value,
        label: FONT_LABELS[value],
        fontFamily: FONT_STACKS[value],
    }));

    function updateState(changes) {
        if (!themeState) return;
        const next = { ...themeState, ...changes };
        setThemeState(next);
        applyThemeState(next);
    }

    function selectTheme(value) {
        if (value === themeState.theme) return;
        updateState({ theme: value });
    }

    function setRound(next) {
        updateState({ round: next });
    }

    function setGlassScheme(next) {
        if (next === themeState.glassScheme) return;
        updateState({ glassScheme: next });
    }

    function setCustomColor(index, value) {
        const colors = [...themeState.glassCustom];
        if (colors[index] === value) return;
        colors[index] = value;
        updateState({ glassCustom: colors });
    }

    function addCustomColor() {
        if (themeState.glassCustom.length >= MAX_GLASS_CUSTOM_COLORS) return;
        updateState({ glassCustom: [...themeState.glassCustom, '#4a78fc'] });
    }

    function removeCustomColor(index) {
        if (themeState.glassCustom.length <= 1) return;
        const colors = [...themeState.glassCustom];
        colors.splice(index, 1);
        updateState({ glassCustom: colors });
    }

    function setGlassAnim(next) {
        updateState({ glassAnim: next });
    }

    function setGlassFlag(next) {
        updateState({ glassFlag: next });
    }

    function setFontValue(nextFont) {
        document.documentElement.dataset.font = nextFont;
        setFont(nextFont);
        try {
            localStorage.setItem('font', nextFont);
        } catch (e) {
            // ignore
        }
    }

    // Derived look state. Computed before any guard so the font pill's
    // styles can be memoized from the round setting.
    const round = themeState ? themeState.round : false;
    const fontSelectStyles = React.useMemo(() => makeFontSelectStyles(round), [round]);

    const theme = themeState ? themeState.theme : systemTheme();
    const glassScheme = themeState ? themeState.glassScheme : 'enby';
    const glassCustom = themeState ? themeState.glassCustom : [...DEFAULT_GLASS_CUSTOM_COLORS];
    const glassAnim = themeState ? themeState.glassAnim : false;
    const glassFlag = themeState ? themeState.glassFlag : false;
    const customActive = glassScheme === CUSTOM_SCHEME;

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Settings</h1>
            <nav className={styles.tabs} aria-label="Account navigation">
                <a className={styles.tab} href="/account">
                    My Account
                </a>
                <span className={`${styles.tab} ${styles.tabActive}`} aria-current="page">
                    Site settings
                </span>
            </nav>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Appearance</h2>
                <div className={styles.themeGrid}>
                    {THEME_VALUES.map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={`${styles.themeCard}${theme === value ? ` ${styles.themeCardActive}` : ''}`}
                            aria-pressed={theme === value}
                            onClick={() => selectTheme(value)}
                        >
                            <span
                                className={styles.themeSwatch}
                                style={{ '--swatch-bg': THEME_SWATCHES[value] }}
                                aria-hidden="true"
                            />
                            {THEME_LABELS[value]}
                        </button>
                    ))}
                </div>
                <label className={styles.themeToggleRow}>
                    <input
                        type="checkbox"
                        checked={round}
                        onChange={(e) => setRound(e.target.checked)}
                        aria-label="Round corners"
                    />
                    Round corners
                </label>
                <div className={styles.glassColours}>
                    <h4 className={styles.colourGroup}>Pride</h4>
                    <div className={styles.colourList}>
                        {GLASS_PRIDE_SCHEMES.map((scheme) => (
                            <button
                                key={scheme}
                                type="button"
                                className={`${styles.colourChip}${glassScheme === scheme ? ` ${styles.colourChipActive}` : ''}`}
                                aria-pressed={glassScheme === scheme}
                                aria-label={glassSchemeLabel(scheme)}
                                title={glassSchemeLabel(scheme)}
                                onClick={() => setGlassScheme(scheme)}
                            >
                                <span
                                    className={styles.colourSwatch}
                                    style={{
                                        '--chip-bg': `linear-gradient(to right, ${GLASS_CHIPS[scheme].join(', ')})`,
                                    }}
                                    aria-hidden="true"
                                />
                                {glassSchemeLabel(scheme)}
                            </button>
                        ))}
                    </div>
                    <h4 className={styles.colourGroup}>Colours</h4>
                    <div className={styles.colourList}>
                        {GLASS_BASIC_SCHEMES.map((scheme) => (
                            <button
                                key={scheme}
                                type="button"
                                className={`${styles.colourChip}${glassScheme === scheme ? ` ${styles.colourChipActive}` : ''}`}
                                aria-pressed={glassScheme === scheme}
                                aria-label={glassSchemeLabel(scheme)}
                                title={glassSchemeLabel(scheme)}
                                onClick={() => setGlassScheme(scheme)}
                            >
                                <span
                                    className={styles.colourSwatch}
                                    style={{
                                        '--chip-bg': `linear-gradient(to right, ${GLASS_CHIPS[scheme].join(', ')})`,
                                    }}
                                    aria-hidden="true"
                                />
                                {glassSchemeLabel(scheme)}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={`${styles.colourChip}${customActive ? ` ${styles.colourChipActive}` : ''}`}
                            aria-pressed={customActive}
                            aria-label="Custom"
                            title="Pick your own colours"
                            onClick={() => setGlassScheme(CUSTOM_SCHEME)}
                        >
                            <span
                                className={styles.colourSwatch}
                                style={{
                                    '--chip-bg':
                                        glassCustom.length === 1
                                            ? glassCustom[0]
                                            : `linear-gradient(to right, ${glassCustom.join(', ')})`,
                                }}
                                aria-hidden="true"
                            />
                            Custom
                        </button>
                    </div>
                    {customActive && (
                        <div className={styles.customEditor}>
                            <div className={styles.colourPickers}>
                                {glassCustom.map((color, i) => (
                                    <div key={i} className={styles.colourPickerRow}>
                                        <label className={styles.colourPicker}>
                                            Colour {i + 1}
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => setCustomColor(i, e.target.value)}
                                                aria-label={`Backdrop colour ${i + 1}`}
                                            />
                                        </label>
                                        {glassCustom.length > 1 && (
                                            <button
                                                type="button"
                                                className={styles.colourRemove}
                                                onClick={() => removeCustomColor(i)}
                                                aria-label={`Remove colour ${i + 1}`}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {glassCustom.length < MAX_GLASS_CUSTOM_COLORS && (
                                <button type="button" className={styles.colourAdd} onClick={addCustomColor}>
                                    Add colour
                                </button>
                            )}
                        </div>
                    )}
                    <div className={styles.glassToggles}>
                        <label className={styles.themeToggleRow}>
                            <input
                                type="checkbox"
                                checked={glassAnim}
                                onChange={(e) => setGlassAnim(e.target.checked)}
                                aria-label="Animate glass backdrop"
                            />
                            Animate backdrop
                        </label>
                        <label className={styles.themeToggleRow}>
                            <input
                                type="checkbox"
                                checked={glassFlag}
                                onChange={(e) => setGlassFlag(e.target.checked)}
                                aria-label="Flag gradient backdrop"
                            />
                            Flag gradient
                        </label>
                    </div>
                </div>
                <div className={styles.siteOptions}>
                    <label className={styles.fontRow}>
                        <span className={styles.fontLabel}>Font</span>
                        <div className={styles.fontSelect}>
                            <Select
                                instanceId="font"
                                name="font"
                                options={fontOptions}
                                value={fontOptions.find(
                                    (opt) => opt.value === (FONT_ORDER.includes(font) ? font : 'ubuntu')
                                )}
                                onChange={(option) => setFontValue(option.value)}
                                formatOptionLabel={({ label, fontFamily }, { context }) =>
                                    context === 'value' || context === 'menu' ? (
                                        <span style={{ fontFamily }}>{label}</span>
                                    ) : (
                                        label
                                    )
                                }
                                isSearchable={false}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                theme={fontSelectTheme}
                                styles={fontSelectStyles}
                            />
                        </div>
                    </label>
                    <BuilderLayoutToggle className={styles.bareToggle} />
                </div>
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Site</h2>
                <div className={styles.siteToggleRow}>
                    <CacheSearchToggle className={styles.bareToggle} />
                    <CacheBuildsToggle className={styles.bareToggle} />
                </div>
            </section>
        </main>
    );
}
