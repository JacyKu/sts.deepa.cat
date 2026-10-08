'use client';

import React from 'react';

// The site-wide Spooky Month switch (moderation -> Theme). The root layout
// reads it server-side and provides it here; SpookyArt renders nothing when
// it is off, so every decoration reverts at once. The default is on, matching
// the server's default when no setting row exists yet.
const SpookyThemeContext = React.createContext(true);

export function SpookyThemeProvider({ enabled, children }) {
    return <SpookyThemeContext.Provider value={enabled !== false}>{children}</SpookyThemeContext.Provider>;
}

export function useSpookyTheme() {
    return React.useContext(SpookyThemeContext);
}

export default SpookyThemeProvider;
