import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

// Session + Discord OAuth plumbing for the STS app.
//
// Required env vars (set on the server, never committed):
//   STS_SESSION_SECRET       - at least 32 chars, encrypts the session cookie
//   STS_DISCORD_CLIENT_ID    - Discord application client id
//   STS_DISCORD_CLIENT_SECRET
//   STS_PUBLIC_BASE_URL      - optional; the app's public origin (e.g.
//                             https://sts.deepa.cat). The Discord OAuth
//                             redirect URI is derived from the request by
//                             default, but behind a proxy (Cloudflare / VPS
//                             reverse proxy) the Host header can be wrong
//                             (e.g. localhost:3001), which makes Discord
//                             bounce back to localhost. Set this to pin it.
//
// The Discord redirect URI must be registered in the Discord developer portal:
//   https://sts.deepa.cat/api/auth/discord/callback   (production)
//   http://localhost:3001/api/auth/discord/callback   (local dev)

export const sessionOptions = {
    cookieName: 'sts-session',
    password: process.env.STS_SESSION_SECRET || 'sts-dev-session-secret-change-in-production-0123456789',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    },
};

export async function getSession() {
    return getIronSession(await cookies(), sessionOptions);
}

// Current Discord user, or null when not logged in.
export async function getDiscordUser() {
    const session = await getSession();
    return session.user || null;
}

export async function requireDiscordUser() {
    const user = await getDiscordUser();
    if (!user) return null;
    return user;
}

// User-level anonymity preference: when on, builds the user publishes are
// anonymous unless they explicitly turn anonymity off for a given build.
export async function getAnonymousPreference() {
    const session = await getSession();
    return session.anonymous === true;
}

export async function setAnonymousPreference(anonymous) {
    const session = await getSession();
    session.anonymous = Boolean(anonymous);
    await session.save();
    return session.anonymous;
}

export function discordAvatarUrl(user) {
    if (!user || !user.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
}

export async function destroySession() {
    const session = await getSession();
    session.destroy();
}

export function discordLoginUrl(state, redirectUri) {
    const params = new URLSearchParams({
        client_id: process.env.STS_DISCORD_CLIENT_ID || '',
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'identify',
        state,
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// The redirect URI Discord must send the user back to. Pinned to
// STS_PUBLIC_BASE_URL when set, otherwise derived from the incoming request.
export function discordRedirectUri(requestUrl) {
    return new URL('/api/auth/discord/callback', appBaseUrl(requestUrl)).toString();
}

// Build an absolute app URL (used for post-OAuth redirects). Pinned to
// STS_PUBLIC_BASE_URL when set — otherwise the proxy's Host header leaks
// through request.url (e.g. https://localhost:6678) and the user bounces to
// localhost instead of the real site.
export function appUrl(requestUrl, path) {
    return new URL(path, appBaseUrl(requestUrl)).toString();
}

function appBaseUrl(requestUrl) {
    return process.env.STS_PUBLIC_BASE_URL ? process.env.STS_PUBLIC_BASE_URL.replace(/\/+$/, '') : requestUrl;
}

// Exchange the OAuth code for an access token, then fetch the user profile.
export async function exchangeDiscordCode(code, redirectUri) {
    const clientId = process.env.STS_DISCORD_CLIENT_ID;
    const clientSecret = process.env.STS_DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('STS_DISCORD_CLIENT_ID / STS_DISCORD_CLIENT_SECRET not configured');
    }

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!tokenRes.ok) {
        throw new Error('Discord token exchange failed: HTTP ' + tokenRes.status);
    }
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
        throw new Error('Discord user fetch failed: HTTP ' + userRes.status);
    }
    const userData = await userRes.json();
    return {
        id: userData.id,
        username: userData.username,
        globalName: userData.global_name || userData.username,
        avatar: userData.avatar || null,
    };
}
