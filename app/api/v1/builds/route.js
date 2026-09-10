import { NextResponse } from 'next/server';
import {
    saveBuild,
    setBuildPublic,
    buildNameTakenByUser,
    findBuildByState,
    countRecentBuilds,
    mergeReferencedCustomItems,
} from '../../../../lib/sts-builds';
import { decodeBuildParam, getBuildTokenVersion, getBuildItemHashes } from '../../../_src/utils/builder/buildUrlCodec';
import { getItemData, getSkillsData } from '../../../_src/utils/itemsData';
import { computeBuildSummary, hasProfanity } from '../../../../lib/public-builds';
import { getDiscordUser, getAnonymousPreference } from '../../../../lib/session';
import { consumeRateLimit, dayWindowMs, getClientIp, rateLimitResponse, readRateLimits } from '../../../../lib/rate-limit';

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    if (!token || typeof token !== 'string' || token.length > 2048) {
        return NextResponse.json({ error: 'invalid token' }, { status: 400 });
    }

    // Reject strings that don't decode to a build.
    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    if (!decodeBuildParam(token, itemData)) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }

    const user = await getDiscordUser();
    // Publicising at save time must pass the same profanity gate as the
    // publicise endpoint: never surface a build with blocked words.
    if (user && body.publicise && hasProfanity({ name: body.name, notes: body.notes, token, itemData })) {
        return NextResponse.json({ error: 'profanity' }, { status: 400 });
    }

    const state = {
        token,
        infusions: body.infusions && typeof body.infusions === 'object' ? body.infusions : {},
        revelation: Boolean(body.revelation),
    };
    // One saved build per name per author: re-saving the identical build is
    // fine (it maps back onto the same row), but a different build whose name
    // one of the user's saved builds already carries is rejected.
    if (user && body.name) {
        const sameStateId = findBuildByState(user.id, state);
        if (buildNameTakenByUser(user.id, body.name, sameStateId || null)) {
            return NextResponse.json({ error: 'duplicate' }, { status: 409 });
        }
    }

    // Daily upload limit: accounts are counted from the database (site and mod
    // saves share the budget); anonymous saves are counted per IP in memory.
    const limits = readRateLimits();
    if (user) {
        if (limits.buildsPerDay > 0 && countRecentBuilds(user.id) >= limits.buildsPerDay) {
            return rateLimitResponse({ hint: 'Daily build limit reached. Try again tomorrow.' });
        }
    } else {
        const quota = consumeRateLimit(`anon-build:${getClientIp(request)}`, limits.anonymousBuildsPerDay, dayWindowMs());
        if (!quota.allowed) {
            return rateLimitResponse({ resetAt: quota.resetAt, hint: 'Daily build limit reached. Try again tomorrow.' });
        }
    }

    // Custom items are not part of the static item data; merge the ones this
    // build references so the saved summary keeps them (otherwise they are
    // dropped from items_json and never show on build cards).
    const summaryData = user ? mergeReferencedCustomItems(itemData, user.id, getBuildItemHashes(token)) : itemData;
    const summary = computeBuildSummary(token, summaryData, skillsData);
    const result = saveBuild({
        state,
        userId: user ? user.id : null,
        name: body.name || null,
        // Notes are a signed-in feature: anonymous saves never carry them.
        notes: user ? body.notes || null : null,
        summary,
    });
    if (!result) {
        return NextResponse.json({ error: 'invalid build' }, { status: 400 });
    }
    if (user && body.publicise) {
        // Unless the request says otherwise, posts default to the user's
        // account-wide anonymity preference (top-right menu toggle).
        const anonymous = body.anonymous !== undefined ? Boolean(body.anonymous) : await getAnonymousPreference();
        setBuildPublic(result.id, user.id, null, {
            isPublic: true,
            anonymous,
            authorName: user.globalName || user.username,
            authorAvatar: user.avatar || null,
            summary,
        });
    }
    const tokenVersion = getBuildTokenVersion(token) ?? '';
    const res = NextResponse.json({
        id: result.id,
        isNew: result.isNew,
        savedToAccount: Boolean(user),
        url: `/b/v${tokenVersion}/${result.id}`,
    });
    // Anonymous rows are editable in place only by the browser that created
    // them: hand out the creator token as an httpOnly cookie. (Set manually:
    // NextResponse.cookies.set is dropped by the dev server in Next 16.)
    if (!user && result.creatorToken) {
        const parts = [
            `sts-build-owner-${result.id}=${result.creatorToken}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            'Max-Age=31536000',
        ];
        if (process.env.NODE_ENV === 'production') parts.push('Secure');
        res.headers.set('Set-Cookie', parts.join('; '));
    }
    return res;
}
