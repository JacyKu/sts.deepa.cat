import { NextResponse } from 'next/server';
import {
    getLinkByUuid,
    getBuild,
    saveBuild,
    BUILD_NAME_MAX,
    countRecentModSaves,
    countRecentBuilds,
    countRecentCustomItems,
    findBuildByState,
    uniqueBuildName,
    mergeReferencedCustomItems,
    getStsUserProfile,
    isDuplicateNameError,
    verifyModToken,
} from '../../../../../lib/sts-builds';
import { createUploadedCustomItems, findUnknownItemNames } from '../../../../../lib/item-uploads';
import { getBuildTokenVersion, getBuildItemHashes } from '../../../../_src/utils/builder/buildUrlCodec';
import { sanitizeBuildTokenForStorage } from '../../../../_src/utils/builder/buildTokenGuard';
import { getItemData, getSkillsData } from '../../../../_src/utils/itemsData';
import { computeBuildSummary } from '../../../../../lib/public-builds';
import { getMinecraftProfile } from '../../../../../lib/minecraft-profile';
import {
    consumeRateLimit,
    dayWindowMs,
    getClientIp,
    rateLimitResponse,
    readRateLimits,
} from '../../../../../lib/rate-limit';
import { bodyTooLarge, tooLargeJson } from '../../../../../lib/request-guards';
import { sanctionBlockForId } from '../../../../../lib/moderation';

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
    // Mod uploads embed up to 50 items with their lore lines, so they get a
    // larger (still bounded) body allowance than the site routes.
    if (bodyTooLarge(request, 1024 * 1024)) return tooLargeJson();
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token || token.length > 2048) {
        return NextResponse.json({ error: 'invalid token' }, { status: 400 });
    }

    const uuid = typeof body?.uuid === 'string' ? body.uuid : '';
    const link = getLinkByUuid(uuid);
    // A linked UUID may only be written to by the device that confirmed the
    // link: the public UUID alone is not proof of ownership.
    if (link && !verifyModToken(uuid, body?.deviceToken)) {
        return NextResponse.json({ error: 'invalid device token' }, { status: 401 });
    }
    // Banned/suspended accounts may browse but not upload builds.
    if (link) {
        const blocked = sanctionBlockForId(link.discord_id);
        if (blocked) return blocked;
    }
    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    // Decode with the mod author's existing custom items merged in, so a token
    // referencing them survives validation intact.
    const tokenData = mergeReferencedCustomItems(itemData, link ? link.discord_id : null, getBuildItemHashes(token));
    // The codec passes unknown strings through as "legacy" best effort, which
    // would let junk through: validate/drop unknown items, charms, classes,
    // skills and out-of-range stats before the token is stored. Binary tokens
    // (all the mod sends) are kept only when they are already clean.
    const sanitized = sanitizeBuildTokenForStorage(token, tokenData, skillsData);
    if (!sanitized.ok) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }
    const storedToken = sanitized.token;

    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, BUILD_NAME_MAX) : null;
    const tokenVersion = getBuildTokenVersion(storedToken);

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
    const basicInfusions = body?.basicInfusions && typeof body.basicInfusions === 'object' ? body.basicInfusions : {};

    const state = { token: storedToken, infusions, revelation: false, basicInfusions };
    // Re-saving an unchanged build keeps its existing row (and link): that is
    // not a new upload, so it must not consume the save budgets below.
    const existingId = findBuildByState(link ? link.discord_id : null, state);

    if (link && !existingId) {
        // Linked: save to the Discord account, private.
        const used = countRecentModSaves(link.discord_id, SAVE_BUDGET.minutes);
        if (used >= SAVE_BUDGET.per) {
            return NextResponse.json({ error: 'too many saves' }, { status: 429 });
        }
    }

    // Daily upload limit: linked accounts are counted from the database (site
    // and mod saves share the budget); unlinked UUIDs are counted in memory.
    const limits = readRateLimits();
    if (!existingId) {
        if (link) {
            if (limits.buildsPerDay > 0 && countRecentBuilds(link.discord_id) >= limits.buildsPerDay) {
                return rateLimitResponse({ hint: 'Daily build limit reached. Try again tomorrow.' });
            }
        } else {
            // Keyed on the caller's IP, not the body UUID: the UUID is
            // client-supplied, so rotating it must not refresh the daily budget.
            const quota = consumeRateLimit(
                `anon-mod-build:${getClientIp(request)}`,
                limits.anonymousBuildsPerDay,
                dayWindowMs()
            );
            if (!quota.allowed) {
                return rateLimitResponse({
                    resetAt: quota.resetAt,
                    hint: 'Daily build limit reached. Try again tomorrow.',
                });
            }
        }
    }

    // Equipment the site doesn't know about (unreleased/event items) is
    // uploaded by the mod alongside the build; create those as custom items
    // on the linked account first so they can be resolved into the summary
    // below (and shown on build cards).
    let createdItems = [];
    if (link && Array.isArray(body?.items) && body.items.length > 0) {
        const unknown = new Set(
            findUnknownItemNames(
                body.items.slice(0, 50).map((item) => item?.name),
                itemData
            )
        );
        const payloads = body.items.slice(0, 50).filter((item) => unknown.has(item?.name));
        // Embedded uploads share the account's daily custom-item budget; when
        // it is exhausted the build still saves, only the items are skipped.
        const usedItems = countRecentCustomItems(link.discord_id, 24 * 60);
        const allowed =
            limits.customItemsPerDay > 0
                ? payloads.slice(0, Math.max(0, limits.customItemsPerDay - usedItems))
                : payloads;
        if (allowed.length > 0) {
            // Attribute created items to the Discord identity: the uploader has
            // no Discord session here, so the stored profile snapshot is used;
            // accounts predating it fall back to the Minecraft profile name.
            const discord = getStsUserProfile(link.discord_id);
            const profile = discord ? null : await getMinecraftProfile(body.uuid).catch(() => null);
            createdItems = createUploadedCustomItems({
                userId: link.discord_id,
                authorName: discord ? discord.name : profile ? profile.name : null,
                authorAvatar: discord ? discord.avatar : null,
                items: allowed,
                itemData,
            }).created;
        }
    }

    // Custom items are not part of the static item data; merge the ones this
    // build references so the saved summary keeps them (otherwise they are
    // dropped from items_json and never show on build cards).
    const summaryData = link
        ? mergeReferencedCustomItems(itemData, link.discord_id, getBuildItemHashes(storedToken))
        : itemData;
    const summary = computeBuildSummary(storedToken, summaryData, skillsData);

    // Build names are unique per account (linked or not): re-saving the
    // identical build keeps its own name, while a different build whose name
    // the account already uses gets " (2)", " (3)", ... appended - the mod
    // path behaves exactly like the site. Other accounts may share a name.
    const ownerId = link ? link.discord_id : null;
    const buildName = name ? uniqueBuildName(ownerId, name, existingId) : null;
    let result;
    try {
        result = saveBuild({
            state,
            userId: ownerId,
            name: buildName,
            notes: null,
            summary,
            source: 'mod',
        });
    } catch (error) {
        if (isDuplicateNameError(error)) {
            return NextResponse.json({ error: 'duplicate' }, { status: 409 });
        }
        throw error;
    }
    if (!result) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }

    const savedRow = getBuild(result.id);
    return NextResponse.json({
        linked: Boolean(link),
        saved: true,
        id: result.id,
        isNew: result.isNew,
        // The final name (duplicates get " (2)", ... appended).
        name: buildName,
        // The build's revision (?v=) for the link the mod shows back.
        version: savedRow ? savedRow.revision || 1 : null,
        url: tokenVersion ? `/b/v${tokenVersion}/${result.id}` : `/b/${result.id}`,
        createdItems,
    });
}
