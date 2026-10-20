'use client';

import React from 'react';
import SpookyEnding from './spookyEnding';

// The site-wide Spooky Month switch (moderation -> Theme). The root layout
// reads it server-side and provides it here; SpookyArt renders nothing when
// it is off, so every decoration reverts at once. Switching it off starts a
// one-day farewell: the art stays up, this browser is asked once whether to
// end it (with the Deltarune explosion), and after the day the server stops
// rendering both the art and the prompt.
const SpookyThemeContext = React.createContext(true);
const SPOOKY_ENDED_KEY = 'sts.spookyEndedAt';

// How often an open page asks whether the theme changed. Every page already
// keeps a notifications SSE connection open, so this stays on the gentle side;
// it only runs while the decorations are on or the prompt is still waiting.
const POLL_MS = 60 * 1000;

export function SpookyThemeProvider({ enabled, ending = false, endedAt = null, children }) {
    // Server props on first render, then kept live by the poll below.
    const [live, setLive] = React.useState({
        active: enabled !== false,
        ending: Boolean(ending),
        endedAt: endedAt ? String(endedAt) : null,
    });
    // This browser already confirmed the current farewell event.
    const [ended, setEnded] = React.useState(false);
    // The stored flag is only known after hydration; hold the prompt back
    // until then so an already-exploded browser never flashes the modal.
    const [ready, setReady] = React.useState(!ending);

    React.useEffect(() => {
        setLive({
            active: enabled !== false,
            ending: Boolean(ending),
            endedAt: endedAt ? String(endedAt) : null,
        });
    }, [enabled, ending, endedAt]);

    // One explosion per farewell event: the confirmed event id is remembered
    // in this browser (and mirrored on <html> so the boot script can hide the
    // art before the first paint).
    React.useEffect(() => {
        if (!live.ending || !live.endedAt) {
            setEnded(false);
            setReady(true);
            document.documentElement.removeAttribute('data-spooky-ended');
            return;
        }
        let done = false;
        try {
            done = window.localStorage.getItem(SPOOKY_ENDED_KEY) === live.endedAt;
        } catch (e) {
            done = false;
        }
        setEnded(done);
        setReady(true);
        if (done) document.documentElement.setAttribute('data-spooky-ended', '1');
        else document.documentElement.removeAttribute('data-spooky-ended');
    }, [live.ending, live.endedAt]);

    // Notice the switch-off (and the end of the farewell day) without a
    // reload. Runs while the art is up (or the prompt is waiting), so a tab
    // that confirmed still notices the theme being turned back on.
    React.useEffect(() => {
        if (!live.active && !live.ending) return undefined;
        let cancelled = false;
        const timer = setInterval(async () => {
            if (document.visibilityState === 'hidden') return;
            try {
                const response = await fetch('/api/v2/spooky', { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                if (cancelled) return;
                setLive({
                    active: Boolean(data.active),
                    ending: Boolean(data.ending),
                    endedAt: data.endedAt ? String(data.endedAt) : null,
                });
            } catch (e) {
                // transient failure; the next tick retries
            }
        }, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [live.active, live.ending]);

    function confirmEnd() {
        try {
            window.localStorage.setItem(SPOOKY_ENDED_KEY, live.endedAt || '');
        } catch (e) {
            // storage unavailable; the explosion still plays once per page view
        }
        document.documentElement.setAttribute('data-spooky-ended', '1');
        setEnded(true);
    }

    const show = live.active && !ended;

    return (
        <SpookyThemeContext.Provider value={show}>
            {children}
            {live.ending && ready && <SpookyEnding ended={ended} onConfirm={confirmEnd} />}
        </SpookyThemeContext.Provider>
    );
}

export function useSpookyTheme() {
    return React.useContext(SpookyThemeContext);
}

export default SpookyThemeProvider;
