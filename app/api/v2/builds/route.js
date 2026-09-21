import { NextResponse } from 'next/server';
import {
    saveBuild,
    setBuildPublic,
    getBuild,
    uniqueBuildName,
    findBuildByState,
    countRecentBuilds,
    mergeReferencedCustomItems,
    isDuplicateNameError,
    preferredAuthorAvatar,
} from '../../../../lib/sts-builds';
import { getBuildTokenVersion, getBuildItemHashes } from '../../../_src/utils/builder/buildUrlCodec';
import { sanitizeBuildTokenForStorage } from '../../../_src/utils/builder/buildTokenGuard';
import { getItemData, getSkillsData } from '../../../_src/utils/itemsData';
import { computeBuildSummary, hasProfanity } from '../../../../lib/public-builds';
import { getDiscordUser, getAnonymousPreference } from '../../../../lib/session';
import { sanctionBlock } from '../../../../lib/moderation';
import { bodyTooLarge, tooLargeJson } from '../../../../lib/request-guards';
import {
    consumeRateLimit,
    dayWindowMs,
    getClientIp,
    rateLimitResponse,
    readRateLimits,
} from '../../../../lib/rate-limit';

export async function POST(request) {
    if (bodyTooLarge(request)) return tooLargeJson();
    const body = await request.json().catch(() => null);
    const token = body?.token;
    if (!token || typeof token !== 'string' || token.length > 2048) {
        return NextResponse.json({ error: 'invalid token' }, { status: 400 });
    }
    // Signed-out saves are just link snapshots (unowned rows): no account is
    // needed and no ownership token is handed out. Anything that *posts*
    // (publicise, anonymous or not) requires the account, so anonymously
    // posted builds stay on the user's account instead of a local token.
    const user = await getDiscordUser();
    // Banned/suspended accounts may browse but not save anything.
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;

    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    // Custom items referenced by the token are resolved first so validation,
    // the profanity gate and the summary all see the same item set.
    const ownerId = user ? user.id : null;
    const summaryData = mergeReferencedCustomItems(itemData, ownerId, getBuildItemHashes(token));
    // The codec passes unknown strings through as "legacy" best effort, so
    // every value is checked before it reaches the database: unknown items and
    // charms, invalid classes/specs/skills and out-of-range stats are dropped
    // (or the save is refused for tampered binary tokens).
    const sanitized = sanitizeBuildTokenForStorage(token, summaryData, skillsData);
    if (!sanitized.ok) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }
    const storedToken = sanitized.token;
    // Publicising at save time must pass the same profanity gate as the
    // publicise endpoint: never surface a build with blocked words.
    if (user && body.publicise && hasProfanity({ name: body.name, notes: body.notes, token: storedToken, itemData: summaryData })) {
        return NextResponse.json({ error: 'profanity' }, { status: 400 });
    }

    const state = {
        token: storedToken,
        infusions: body.infusions && typeof body.infusions === 'object' ? body.infusions : {},
        revelation: Boolean(body.revelation),
        basicInfusions: body.basicInfusions && typeof body.basicInfusions === 'object' ? body.basicInfusions : {},
    };
    // Re-saving an unchanged build keeps its existing row (and link). Resolve
    // that before the daily limit: nothing is created, so it must not consume
    // the quota. Build names are unique per account: re-saving the identical
    // build keeps its name, while a different build whose name the account
    // already uses gets " (2)", " (3)", ... appended automatically. Other
    // accounts may use the same name.
    const existingId = findBuildByState(ownerId, state);
    const buildName = body.name ? uniqueBuildName(ownerId, body.name, existingId) : null;

    // Daily upload limit: accounts are counted from the database (site and mod
    // saves share the budget); signed-out saves are counted per IP in memory.
    if (!existingId) {
        const limits = readRateLimits();
        if (user) {
            if (limits.buildsPerDay > 0 && countRecentBuilds(user.id) >= limits.buildsPerDay) {
                return rateLimitResponse({ hint: 'Daily build limit reached. Try again tomorrow.' });
            }
        } else {
            const quota = consumeRateLimit(
                `anon-build:${getClientIp(request)}`,
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

    // Custom items are not part of the static item data; the summary was built
    // from the merged item set above so referenced custom items stay on the
    // build card.
    const summary = computeBuildSummary(storedToken, summaryData, skillsData);
    let result;
    try {
        result = saveBuild({
            state,
            userId: ownerId,
            name: buildName,
            // Notes are a signed-in feature: signed-out saves never carry them.
            notes: user ? body.notes || null : null,
            summary,
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
    if (user && body.publicise) {
        // Unless the request says otherwise, posts default to the user's
        // account-wide anonymity preference (top-right menu toggle). The row
        // stays on the account either way - anonymous is display only.
        const anonymous = body.anonymous !== undefined ? Boolean(body.anonymous) : await getAnonymousPreference();
        setBuildPublic(result.id, user.id, null, {
            isPublic: true,
            anonymous,
            authorName: user.globalName || user.username,
            authorAvatar: preferredAuthorAvatar(user.id, user.avatar),
            summary,
        });
    }
    const tokenVersion = getBuildTokenVersion(storedToken);
    const savedRow = getBuild(result.id);
    return NextResponse.json({
        id: result.id,
        isNew: result.isNew,
        savedToAccount: Boolean(user),
        // The final name (duplicates get " (2)", ... appended server-side),
        // so the builder can update its name field.
        name: buildName,
        // The build's revision is the ?v= cache-buster for the copied link:
        // it only changes when the build is updated.
        version: savedRow ? savedRow.revision || 1 : null,
        url: tokenVersion ? `/b/v${tokenVersion}/${result.id}` : `/b/${result.id}`,
    });
}
