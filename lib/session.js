import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getAvatarSource, listLinksForDiscord, listUserAvatars, uploadedAvatarUrl } from './sts-builds';
import { minecraftAvatarUrl } from './minecraft-profile';

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

const DEV_SESSION_SECRET = 'sts-dev-session-secret-change-in-production-0123456789';

// The session cookie is the trust anchor for every server-side permission
// check: falling back to a hardcoded secret in production would let anyone
// forge a session and impersonate any user. Missing secret = hard failure.
function sessionPassword() {
    const secret = process.env.STS_SESSION_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('STS_SESSION_SECRET is not set: refusing to use the insecure development secret in production');
    }
    return DEV_SESSION_SECRET;
}

export const sessionOptions = {
    cookieName: 'sts-session',
    get password() {
        return sessionPassword();
    },
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    },
};

// Only same-site relative paths may be used as post-login redirects: an
// attacker-supplied absolute URL ("https://evil.com") or protocol-relative
// URL ("//evil.com") would turn the OAuth callback into an open redirect.
export function safeRedirectPath(path, fallback = '/builder') {
    if (typeof path !== 'string') return fallback;
    const trimmed = path.trim();
    // Control characters: the WHATWG URL parser strips tabs/newlines before
    // parsing, so "/\t/evil.com" would resolve to a protocol-relative
    // "//evil.com" and leave the site after login (open redirect).
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return fallback;
    if (trimmed.length > 200) return fallback;
    return trimmed;
}

export async function getSession() {
    return getIronSession(await cookies(), sessionOptions);
}

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

// The profile picture shown across the site for a session user, honoring the
// account's profile-picture preference: the Discord avatar, the cached
// Minecraft head of their first linked UUID, or one of the account's uploaded
// pictures ("upload:<id>"). The candidates are returned too, so the account
// page can preview every option.
export function resolveProfileAvatar(user) {
    if (!user || !user.id) return null;
    const link = listLinksForDiscord(user.id)[0];
    const minecraft = link ? minecraftAvatarUrl(link.uuid) : null;
    const discord = discordAvatarUrl(user);
    const source = getAvatarSource(user.id);
    const uploaded = source.startsWith('upload:') ? uploadedAvatarUrl(source.slice('upload:'.length)) : null;
    const avatarUrl = source === 'minecraft' ? minecraft : source.startsWith('upload:') ? uploaded : discord;
    return {
        avatarUrl,
        avatarSource: source,
        discordAvatarUrl: discord,
        minecraftAvatarUrl: minecraft,
        // Every custom picture saved on the account (for the account page).
        uploadedAvatars: listUserAvatars(user.id),
    };
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
// STS_PUBLIC_BASE_URL when set - otherwise the proxy's Host header leaks
// through request.url (e.g. https://localhost:6678) and the user bounces to
// localhost instead of the real site.
export function appUrl(requestUrl, path) {
    return new URL(path, appBaseUrl(requestUrl)).toString();
}

export function appBaseUrl(requestUrl) {
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
