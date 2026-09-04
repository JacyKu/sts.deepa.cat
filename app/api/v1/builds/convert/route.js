import { NextResponse } from 'next/server';
import { decodeBuildParam, encodeBuildParam } from '../../../../_src/utils/builder/buildUrlCodec';
import { getItemData } from '../../../../_src/utils/itemsData';

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

export async function GET(request) {
    const link = request.nextUrl.searchParams.get('link') || '';
    if (!link.trim()) {
        return NextResponse.json({ error: 'no build link given' }, { status: 400 });
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
