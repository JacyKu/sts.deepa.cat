import { NextResponse } from 'next/server';
import { decodeBuildParam, encodeBuildParam } from '../../../../_src/utils/builder/buildUrlCodec';
import { getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';
import { getItemData } from '../../../../_src/utils/itemsData';
import { getBuild } from '../../../../../lib/sts-builds';

// Mirrors the client-side import parsing (app/_src/components/builder/
// buildImportBar.js): accept a bare token, an old ?build=... URL, or a full
// URL whose /builder path carries the token. The resulting string is decoded
// to the canonical legacy build query and re-encoded with the current token
// format - the exact decoder/encoder the builder import bar uses.
function parseBuildLink(raw) {
    let str = String(raw || '').trim();
    if (!str) return null;
    try {
        if (str.includes('?build=')) {
            const qIdx = str.indexOf('?');
            const paramStr = str.slice(qIdx + 1);
            const params = new URLSearchParams(paramStr);
            str = params.get('build') || '';
            if (!(str.includes('=') && str.includes('&')) && paramStr.includes('=')) {
                // legacy query was spread across raw params (build=m=A&o=B style)
                str = paramStr.replace(/^build=/, '');
            }
        } else if (/^https?:\/\//i.test(str)) {
            const idx = str.lastIndexOf('/builder');
            if (idx === -1) return null;
            str = str.slice(idx + '/builder'.length);
            str = str.replace(/^[/?]/, '');
            const qIdx = str.indexOf('?');
            if (qIdx !== -1) str = str.slice(0, qIdx);
            const fIdx = str.indexOf('#');
            if (fIdx !== -1) str = str.slice(0, fIdx);
        }
        str = decodeURIComponent(str);
    } catch (e) {
        return null;
    }
    str = str.trim();
    const valid = str.startsWith('v1_') || str.startsWith('z:') || (str.includes('=') && str.includes('&'));
    return valid ? str : null;
}

// A saved-build short link (/b/<id> or /b/v<version>/<id>, bare or as a full
// URL) resolves to the row's token instead of a raw token payload.
function parseShortLinkId(raw) {
    let str = String(raw || '').trim();
    try {
        str = decodeURIComponent(str);
    } catch (e) {
        return null;
    }
    const m = str.match(/(?:\/|^)b(?:\/v\d+)?\/([A-Za-z0-9_-]+)(?:[?#].*)?$/);
    return m ? m[1] : null;
}

// The STS site and its dev deployment have separate databases, so a saved
// link (/b/<id>) only resolves on the site that minted it. Full links to the
// other site are proxied to its convert endpoint (with just the path, so the
// other instance treats it as local and never bounces it back).
const KNOWN_STS_HOSTS = new Set(['sts.deepa.cat', 'www.sts.deepa.cat', 'dev.deepa.cat']);

function remoteConvertUrl(link, currentHostname) {
    let url;
    try {
        url = new URL(link);
    } catch (e) {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const hostname = url.hostname.toLowerCase();
    if (!KNOWN_STS_HOSTS.has(hostname)) return null;
    if (hostname === String(currentHostname || '').toLowerCase()) return null;
    return `https://${url.host}/api/v2/builds/convert?link=${encodeURIComponent(url.pathname + url.search)}`;
}

export async function GET(request) {
    let link = request.nextUrl.searchParams.get('link') || '';
    if (!link.trim()) {
        return NextResponse.json({ error: 'no build link given' }, { status: 400 });
    }

    // A link that points at the other STS deployment (sts.deepa.cat vs
    // dev.deepa.cat) is resolved by that site, so saved links can be imported
    // from one another.
    const remote = remoteConvertUrl(link, request.nextUrl.hostname);
    if (remote) {
        try {
            const res = await fetch(remote, { headers: { accept: 'application/json' } });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || !data.token) {
                return NextResponse.json(
                    { error: (data && data.error) || 'could not read that build link' },
                    { status: res.status === 200 ? 502 : res.status }
                );
            }
            return NextResponse.json(data);
        } catch (e) {
            return NextResponse.json({ error: 'could not reach the other site' }, { status: 502 });
        }
    }

    // A lone build id is treated as its /b/<id> short link (the import bar
    // accepts a bare id the same way the database search does).
    if (
        !link.includes('/') &&
        !link.includes('=') &&
        !link.startsWith('v1_') &&
        !link.startsWith('z:') &&
        /^[A-Za-z0-9_-]{4,40}$/.test(link.trim())
    ) {
        link = '/b/' + link.trim();
    }

    // Saved-build short links resolve straight to the stored token (no
    // re-encoding needed - the builder keeps working on the DB row).
    const shortId = parseShortLinkId(link);
    if (shortId) {
        const row = getBuild(shortId);
        if (!row) {
            return NextResponse.json({ error: 'build not found' }, { status: 404 });
        }
        const tokenVersion = getBuildTokenVersion(row.token);
        const url = tokenVersion ? `/b/v${tokenVersion}/${row.id}` : `/b/${row.id}`;
        // The token cannot carry the delve infusions / Revelation / basic
        // infusions, so hand the caller the row's saved state too. The import
        // bar stashes it for the builder, which lets a build be imported from
        // the other STS site with everything intact.
        const saved = row.parsedState || {};
        const state = {
            infusions: saved.infusions && typeof saved.infusions === 'object' ? saved.infusions : {},
            revelation: Boolean(saved.revelation),
        };
        if (saved.basicInfusions && typeof saved.basicInfusions === 'object') {
            state.basicInfusions = saved.basicInfusions;
        }
        if (saved.globalInfusions && typeof saved.globalInfusions === 'object') {
            state.globalInfusions = saved.globalInfusions;
        }
        return NextResponse.json({ token: row.token, url, state });
    }

    const token = parseBuildLink(link);
    if (!token) {
        return NextResponse.json({ error: 'could not read that build link' }, { status: 400 });
    }

    // Decode to the canonical legacy build string, then re-encode as a
    // current token. Binary tokens hash item names, so the item data is
    // needed to recover them (same lookup the builder page performs).
    const itemData = await getItemData();
    const legacy = decodeBuildParam(token, itemData);
    if (!legacy) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }
    const converted = encodeBuildParam(legacy);
    if (!converted) {
        return NextResponse.json({ error: 'could not convert that build' }, { status: 400 });
    }
    return NextResponse.json({ token: converted, url: '/builder/' + converted });
}
