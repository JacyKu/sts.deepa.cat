import { NextResponse } from 'next/server';
import { saveBuild, setBuildPublic } from '../../../../lib/sts-builds';
import { decodeBuildParam, getBuildTokenVersion } from '../../../_src/utils/builder/buildUrlCodec';
import { getItemData, getSkillsData } from '../../../_src/utils/itemsData';
import { computeBuildSummary, hasProfanity } from '../../../../lib/public-builds';
import { getDiscordUser, getAnonymousPreference } from '../../../../lib/session';

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
    const summary = computeBuildSummary(token, itemData, skillsData);
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
