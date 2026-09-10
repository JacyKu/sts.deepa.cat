import { NextResponse } from 'next/server';
import {
    getLinkByUuid,
    saveBuild,
    countRecentModSaves,
    countRecentBuilds,
    countRecentCustomItems,
    buildNameTakenByUser,
    findBuildByState,
} from '../../../../../lib/sts-builds';
import { createUploadedCustomItems, findUnknownItemNames } from '../../../../../lib/item-uploads';
import { decodeBuildParam, getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';
import { getItemData, getSkillsData } from '../../../../_src/utils/itemsData';
import { computeBuildSummary } from '../../../../../lib/public-builds';
import { getMinecraftProfile } from '../../../../../lib/minecraft-profile';
import { consumeRateLimit, dayWindowMs, rateLimitResponse, readRateLimits } from '../../../../../lib/rate-limit';

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

    const uuid = typeof body?.uuid === 'string' ? body.uuid : '';
    const link = getLinkByUuid(uuid);
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

    // Daily upload limit: linked accounts are counted from the database (site
    // and mod saves share the budget); unlinked UUIDs are counted in memory.
    const limits = readRateLimits();
    if (link) {
        if (limits.buildsPerDay > 0 && countRecentBuilds(link.discord_id) >= limits.buildsPerDay) {
            return rateLimitResponse({ hint: 'Daily build limit reached. Try again tomorrow.' });
        }
    } else {
        const quota = consumeRateLimit(`anon-mod-build:${uuid}`, limits.anonymousBuildsPerDay, dayWindowMs());
        if (!quota.allowed) {
            return rateLimitResponse({ resetAt: quota.resetAt, hint: 'Daily build limit reached. Try again tomorrow.' });
        }
    }

    const summary = computeBuildSummary(token, itemData, skillsData);
    // Linked saves land on the Discord account: one saved build per name per
    // author, so a loadout whose name another of the player's saved builds
    // already carries is rejected (re-saving the identical build is fine).
    if (link && name) {
        const sameStateId = findBuildByState(link.discord_id, { token, infusions, revelation: false });
        if (buildNameTakenByUser(link.discord_id, name, sameStateId || null)) {
            return NextResponse.json({ error: 'duplicate' }, { status: 409 });
        }
    }
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

    // Equipment the site doesn't know about (unreleased/event items) is
    // uploaded by the mod alongside the build; create those as custom items
    // on the linked account so the build renders correctly for its owner.
    let createdItems = [];
    if (link && Array.isArray(body?.items) && body.items.length > 0) {
        const unknown = new Set(findUnknownItemNames(body.items.map((item) => item?.name), itemData));
        const payloads = body.items.filter((item) => unknown.has(item?.name));
        // Embedded uploads share the account's daily custom-item budget; when
        // it is exhausted the build still saves, only the items are skipped.
        const usedItems = countRecentCustomItems(link.discord_id, 24 * 60);
        const allowed =
            limits.customItemsPerDay > 0
                ? payloads.slice(0, Math.max(0, limits.customItemsPerDay - usedItems))
                : payloads;
        if (allowed.length > 0) {
            const profile = await getMinecraftProfile(body.uuid).catch(() => null);
            createdItems = createUploadedCustomItems({
                userId: link.discord_id,
                authorName: profile ? profile.name : null,
                authorAvatar: null,
                items: allowed,
                itemData,
            }).created;
        }
    }

    return NextResponse.json({
        linked: Boolean(link),
        saved: true,
        id: result.id,
        isNew: result.isNew,
        url: `/b/v${tokenVersion}/${result.id}`,
        createdItems,
    });
}
