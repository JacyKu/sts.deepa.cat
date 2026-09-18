import { NextResponse } from 'next/server';
import { getActiveSanction } from './sts-builds.js';
import { getDiscordUser } from './session.js';

// Moderation access + sanction guards.
//
//   STS_MODERATOR_IDS - comma (or whitespace) separated Discord IDs allowed
//                       to use the moderation page and API. Unset = nobody,
//                       so the tools are dark until the server opts in.
//
// A sanctioned account keeps browsing, but every write (saving or uploading
// builds and custom items, skill sets, profile pictures, new Minecraft links)
// is refused with the reason/expiry; the client shows a banner from the
// session payload.

export function moderatorIds() {
    const raw = process.env.STS_MODERATOR_IDS || '';
    return raw
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean);
}

export function isModerator(discordId) {
    return Boolean(discordId) && moderatorIds().includes(String(discordId));
}

// The response to return for a sanctioned account's write, or null when the
// account is allowed to write. Used by session-authenticated routes and by
// the mod upload routes (which resolve the account from the linked UUID).
export function sanctionBlockForId(discordId) {
    if (!discordId) return null;
    const sanction = getActiveSanction(discordId);
    if (!sanction) return null;
    const banned = sanction.kind === 'ban';
    return NextResponse.json(
        {
            error: banned ? 'banned' : 'suspended',
            reason: sanction.reason || null,
            expiresAt: sanction.expires_at || null,
            hint: banned
                ? 'Your STS account has been banned. Contact the staff if you believe this is a mistake.'
                : 'Your STS account is suspended. You can use STS again after the suspension ends.',
        },
        { status: 403 }
    );
}

export function sanctionBlock(user) {
    return user ? sanctionBlockForId(user.id) : null;
}

// Resolves the signed-in moderator for a moderation API route: returns
// { user } or { error: NextResponse }.
export async function requireModerator() {
    const user = await getDiscordUser();
    if (!user) {
        return { error: NextResponse.json({ error: 'not authenticated' }, { status: 401 }) };
    }
    if (!isModerator(user.id)) {
        return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
    }
    return { user };
}
