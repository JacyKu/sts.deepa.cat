import { NextResponse } from 'next/server';
import { requireModerator } from '../../../../../lib/moderation';
import {
    isSpookyThemeEnabled,
    setSiteSetting,
    SPOOKY_ENDED_AT_SETTING,
    SPOOKY_THEME_SETTING,
} from '../../../../../lib/sts-builds';

// Site-wide Spooky Month decoration toggle (moderator only).
//   GET  /api/v2/moderation/theme -> { spooky }
//   POST /api/v2/moderation/theme { spooky: boolean } -> { spooky }
// With the theme off every server-rendered page hides the artwork and the
// site looks exactly like it did before the event. Switching it off starts a
// one-day farewell (see getSpookyThemeState) during which pages still show
// the art and visitors get the "End Halloween?" prompt.
export const dynamic = 'force-dynamic';

export async function GET() {
    const { error } = await requireModerator();
    if (error) return error;
    return NextResponse.json({ spooky: isSpookyThemeEnabled() });
}

export async function POST(request) {
    const { error } = await requireModerator();
    if (error) return error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.spooky !== 'boolean') {
        return NextResponse.json({ error: 'spooky (boolean) required' }, { status: 400 });
    }
    if (body.spooky) {
        setSiteSetting(SPOOKY_THEME_SETTING, '1');
        // A fresh event: the next switch-off should prompt again.
        setSiteSetting(SPOOKY_ENDED_AT_SETTING, '');
    } else {
        // Only the first switch-off starts the farewell day; saving "off"
        // again while it is already off must not extend the window.
        if (isSpookyThemeEnabled()) setSiteSetting(SPOOKY_ENDED_AT_SETTING, String(Date.now()));
        setSiteSetting(SPOOKY_THEME_SETTING, '0');
    }
    return NextResponse.json({ spooky: body.spooky });
}
