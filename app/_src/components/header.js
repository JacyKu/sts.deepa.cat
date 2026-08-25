'use client';

import React from 'react';
import Select from 'react-select';
import TranslatableText from './translatableText';
import LoreToggle from './items/loreToggle';
import ObtainmentToggle from './items/obtainmentToggle';
import HideSkinsToggle from './items/hideSkinsToggle';
import MaxMasterworkToggle from './items/maxMasterworkToggle';
import BuildListToggle from './items/buildListToggle';
import AnimationsToggle from './items/animationsToggle';
import styles from '../styles/Header.module.css';
import Link from 'next/link';
import { getStsBase } from '../utils/base';
import { useLowResource } from './lowResourceContext';

// Discord login state chip: "Log in" when logged out, avatar + "My Builds"
// + logout when logged in. Session state lives in the shared useSessionState
// hook so the settings menu (Header) can show the same user.
export function useSessionState() {
    const [user, setUser] = React.useState(null);
    const [anonymous, setAnonymous] = React.useState(false);
    const [checked, setChecked] = React.useState(false);

    React.useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d && d.user) {
                    setUser(d.user);
                    setAnonymous(Boolean(d.user.anonymous));
                }
            })
            .catch(() => {})
            .finally(() => setChecked(true));
    }, []);

    return { user, setUser, anonymous, setAnonymous, checked };
}

export function AccountChip({ session }) {
    const user = session?.user ?? null;
    const checked = session?.checked ?? false;
    const setUser = session?.setUser;
    const [base, setBase] = React.useState('/sts');

    React.useEffect(() => {
        setBase(getStsBase());
    }, []);

    function logout() {
        fetch('/api/auth/logout', { method: 'POST' })
            .then(() => {
                setUser(null);
                window.location.reload();
            })
            .catch(() => {});
    }

    return (
        <div className={styles.accountChip}>
            {!checked ? null : !user ? (
                <a
                    className={styles.accountIcon}
                    href={`/api/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`}
                    title="Log in with Discord"
                    aria-label="Log in with Discord"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                </a>
            ) : (
                <>
                    <Link
                        className={styles.accountBtn}
                        href={base + '/builds'}
                        title={user.globalName || user.username}
                    >
                        {user.avatarUrl && (
                            <img className={styles.avatar} src={user.avatarUrl} alt="" width={22} height={22} />
                        )}
                        <span className={styles.accountName}>
                            <TranslatableText identifier="auth.myBuilds" />
                        </span>
                    </Link>
                    <button
                        type="button"
                        className={styles.accountBtn}
                        onClick={logout}
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                            <path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
}

function getPreferredTheme() {
    if (typeof window === 'undefined') return 'dark';
    try {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {
        // ignore
    }
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
}

const FONT_ORDER = ['ubuntu', 'minecraft', 'default'];
const FONT_LABELS = { ubuntu: 'Default', minecraft: 'Minecraft', default: 'Legacy' };
const FONT_STACKS = {
    ubuntu: "'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    minecraft: "'Minecraft', monospace",
    default:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
};

const selectTheme = (theme) => ({
    ...theme,
    borderRadius: 0,
    colors: {
        ...theme.colors,
        primary: 'var(--text-1)',
        primary25: 'var(--surface-2)',
        neutral0: 'var(--glass-1)',
        neutral5: 'var(--glass-2)',
        neutral10: 'var(--glass-2)',
        neutral20: 'var(--control-border)',
        neutral30: 'var(--control-border-hover)',
        neutral60: 'var(--text-2)',
        neutral80: 'var(--text-1)',
    },
});

const selectStyles = {
    container: (base) => ({ ...base, width: '100%' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
};

function HeaderSelect({ options, value, onChange, instanceId, className, formatOptionLabel }) {
    return (
        <div className={className}>
            <Select
                instanceId={instanceId}
                name={instanceId}
                options={options}
                value={options.find((opt) => opt.value === value)}
                onChange={onChange}
                formatOptionLabel={formatOptionLabel}
                isSearchable={false}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                theme={selectTheme}
                styles={selectStyles}
            />
        </div>
    );
}

// The STS nav links, rendered in the center of the shared SiteNav top bar.
export function HeaderNav() {
    const [base, setBase] = React.useState('/sts');
    React.useEffect(() => {
        setBase(getStsBase());
    }, []);
    return (
        <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.navButton} href={base + '/items'}>
                <TranslatableText identifier="index.pages.items.title" />
            </Link>
            <Link className={styles.navButton} href={base + '/builder'}>
                <TranslatableText identifier="index.pages.builder.title" />
            </Link>
            <Link className={styles.navButton} href={base + '/database'}>
                <TranslatableText identifier="index.pages.database.title" />
            </Link>
        </nav>
    );
}

// The STS app settings, rendered on the right side of the shared SiteNav bar.
export default function Header() {
    const [theme, setTheme] = React.useState('dark');
    const [font, setFont] = React.useState('ubuntu');
    const { lowRes, toggle: toggleLowRes } = useLowResource();
    const session = useSessionState();

    function toggleAnonymize(event) {
        const next = Boolean(event.target.checked);
        const prev = session.anonymous;
        session.setAnonymous(next);
        fetch('/api/auth/anonymity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anonymous: next }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => session.setAnonymous(Boolean(d.anonymous)))
            .catch(() => session.setAnonymous(prev));
    }

    React.useEffect(() => {
        const current = document.documentElement.dataset.theme;
        if (current === 'light' || current === 'dark') {
            setTheme(current);
        } else {
            const preferred = getPreferredTheme();
            document.documentElement.dataset.theme = preferred;
            setTheme(preferred);
        }
        const storedFont = (() => {
            try {
                return localStorage.getItem('font');
            } catch (e) {
                return null;
            }
        })();
        if (FONT_ORDER.includes(storedFont)) {
            document.documentElement.dataset.font = storedFont;
            setFont(storedFont);
        }
    }, []);

    const setThemeValue = (nextTheme) => {
        document.documentElement.dataset.theme = nextTheme;
        setTheme(nextTheme);
        try {
            localStorage.setItem('theme', nextTheme);
        } catch (e) {
            // ignore
        }
    };

    const setFontValue = (nextFont) => {
        document.documentElement.dataset.font = nextFont;
        setFont(nextFont);
        try {
            localStorage.setItem('font', nextFont);
        } catch (e) {
            // ignore
        }
    };

    const fontOptions = FONT_ORDER.map((value) => ({
        value,
        label: FONT_LABELS[value],
        fontFamily: FONT_STACKS[value],
    }));
    const themeOptions = [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
    ];

    const [menuOpen, setMenuOpen] = React.useState(false);
    const closeMenu = () => setMenuOpen(false);

    return (
        <div className={styles.controls}>
            <AccountChip session={session} />
            <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Settings"
                aria-expanded={menuOpen}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                </svg>
            </button>
            {menuOpen && <div className={styles.menuBackdrop} onClick={closeMenu} />}
            <div className={`${styles.menuPanel}${menuOpen ? ` ${styles.menuOpen}` : ''}`}>
                {session.user && (
                    <label className={`${styles.toggle} ${styles.loreToggle}`}>
                        <input
                            type="checkbox"
                            checked={session.anonymous}
                            onChange={toggleAnonymize}
                            aria-label="Anonymize me"
                        />
                        <TranslatableText identifier="auth.anonymizeMe" />
                    </label>
                )}
                <label className={`${styles.toggle} ${styles.loreToggle}`}>
                    <input type="checkbox" checked={lowRes} onChange={toggleLowRes} aria-label="Hide textures" />
                    Hide Textures
                </label>
                <AnimationsToggle className={styles.loreToggle} />
                <LoreToggle className={styles.loreToggle} />
                <ObtainmentToggle className={styles.loreToggle} />
                <HideSkinsToggle className={styles.loreToggle} />
                <MaxMasterworkToggle className={styles.loreToggle} />
                <BuildListToggle className={styles.loreToggle} />
                <HeaderSelect
                    instanceId="font"
                    options={fontOptions}
                    value={font}
                    onChange={(option) => setFontValue(option.value)}
                    formatOptionLabel={({ label, fontFamily }, { context }) =>
                        context === 'menu' && fontFamily ? <span style={{ fontFamily }}>{label}</span> : label
                    }
                    className={styles.fontSelect}
                />
                <HeaderSelect
                    instanceId="theme"
                    options={themeOptions}
                    value={theme}
                    onChange={(option) => setThemeValue(option.value)}
                    className={styles.themeSelect}
                />
            </div>
        </div>
    );
}
