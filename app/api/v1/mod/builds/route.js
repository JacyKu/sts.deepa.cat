import { NextResponse } from 'next/server';
import { getLinkByUuid, saveBuild, countRecentModSaves } from '../../../../../lib/sts-builds';
import { decodeBuildParam, getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';
import { getItemData, getSkillsData } from '../../../../_src/utils/itemsData';
import { computeBuildSummary } from '../../../../../lib/public-builds';

// Save a build from the STS mod. The mod sends the v1_ build token it
// generated, optionally with the player's Minecraft UUID:
//  - UUID linked to a Discord account -> saved to that account (private,
//    never publicised from here), short /b/vN/<id> link back
//  - UUID missing or unlinked -> saved anonymously (no account attached),
//    same as saving from the site while logged out; short link back
// Every save goes through the API so the player always gets a short link,
// never the raw token.
//
// Account saves are limited to keep a leaked UUID from flooding someone's
// profile with junk builds.
const SAVE_BUDGET = { per: 20, minutes: 60 };

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token || token.length > 2048) {
        return NextResponse.json({ error: 'invalid token' }, { status: 400 });
    }

    const link = getLinkByUuid(typeof body?.uuid === 'string' ? body.uuid : '');
    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    // Decode must produce a real build querystring: the codec passes unknown
    // strings through as "legacy" best effort, which would let junk through.
    const decoded = decodeBuildParam(token, itemData);
    if (!decoded || typeof decoded !== 'string' || !decoded.includes('&') || !decoded.includes('m=')) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }

    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 30) : null;
    const tokenVersion = getBuildTokenVersion(token) ?? '';

    // Delve infusion preferences picked in the armoury ("Preferred Delve
    // Infusion" on each equipment icon). Only known slot names with short
    // string values survive.
    const SLOT_RE = /^(mainhand|offhand|helmet|chestplate|leggings|boots)$/;
    const sanitizeInfusions = (raw) => {
        const out = {};
        if (!raw || typeof raw !== 'object') return out;
        for (const [slot, value] of Object.entries(raw)) {
            if (!SLOT_RE.test(slot) || typeof value !== 'string' || !value) continue;
            const clean = value.trim().slice(0, 64);
            if (clean && clean !== 'None' && clean !== 'any') out[slot] = clean;
        }
        return out;
    };
    const infusions = sanitizeInfusions(body?.infusions);

    if (link) {
        // Linked: save to the Discord account, private.
        const used = countRecentModSaves(link.discord_id, SAVE_BUDGET.minutes);
        if (used >= SAVE_BUDGET.per) {
            return NextResponse.json({ error: 'too many saves' }, { status: 429 });
        }
    }

    const summary = computeBuildSummary(token, itemData, skillsData);
    const result = saveBuild({
        state: { token, infusions, revelation: false },
        userId: link ? link.discord_id : null,
        name,
        notes: null,
        summary,
        source: 'mod',
    });
    if (!result) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }
    return NextResponse.json({
        linked: Boolean(link),
        saved: true,
        id: result.id,
        isNew: result.isNew,
        url: `/b/v${tokenVersion}/${result.id}`,
    });
}
