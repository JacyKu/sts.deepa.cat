import { NextResponse } from 'next/server';
import { getBuild, updateBuild, updateBuildState, deleteBuild, setBuildPublic } from '../../../../../lib/sts-builds';
import { computeBuildSummary, hasProfanity } from '../../../../../lib/public-builds';
import { getDiscordUser, getAnonymousPreference, appUrl } from '../../../../../lib/session';
import { decodeBuildParam, getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';
import { getItemData, getSkillsData } from '../../../../_src/utils/itemsData';

export async function GET(request, { params }) {
    const p = await params;
    const row = getBuild(p.id);
    if (!row) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }

    // Redirect to the canonical short link. appUrl pins the public origin
    // (STS_PUBLIC_BASE_URL) so the redirect never leaks a proxy host
    // (e.g. localhost:6678) to the client.
    const tokenVersion = getBuildTokenVersion(row.token) ?? '';
    return NextResponse.redirect(appUrl(request.url, `/b/v${tokenVersion}/${p.id}`));
}

export async function PATCH(request, { params }) {
    const p = await params;
    const user = await getDiscordUser();
    const body = await request.json().catch(() => null);

    // Editing a saved build keeps the same link: the state (token + infusions
    // + revelation) is written in place. Only the owner of an owned row, or
    // the creator (cookie) of an anonymous row, may do this — anyone else
    // gets a 403 so the client forks into a new build instead of overwriting
    // someone else's.
    if (body?.state) {
        const token = typeof body.state.token === 'string' ? body.state.token : '';
        if (!token || token.length > 2048) {
            return NextResponse.json({ error: 'invalid token' }, { status: 400 });
        }
        const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
        if (!decodeBuildParam(token, itemData)) {
            return NextResponse.json({ error: 'invalid build' }, { status: 400 });
        }
        const update = {
            state: {
                token,
                infusions: body.state.infusions && typeof body.state.infusions === 'object' ? body.state.infusions : {},
                revelation: Boolean(body.state.revelation),
            },
        };
        if (body.name !== undefined && body.name !== null) {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name) return NextResponse.json({ error: 'invalid name' }, { status: 400 });
            update.name = name;
        }
        if (body.notes !== undefined && body.notes !== null) {
            update.notes = typeof body.notes === 'string' ? body.notes : '';
        }
        const summary = computeBuildSummary(token, itemData, skillsData);
        // Public builds refresh their denormalized filter columns on every
        // save so the database never shows stale data.
        const row = getBuild(p.id);
        const wantsPublic = body.publicise !== undefined ? Boolean(body.publicise) : row && row.is_public === 1;
        if (wantsPublic && hasProfanity({ name: update.name, notes: update.notes, token, itemData })) {
            return NextResponse.json({ error: 'profanity' }, { status: 400 });
        }
        if (row && row.is_public === 1) {
            update.summary = summary;
        }
        const creatorToken = request.cookies.get(`sts-build-owner-${p.id}`)?.value || null;
        if (!updateBuildState(p.id, user ? user.id : null, creatorToken, update)) {
            return NextResponse.json({ error: 'build not found or not yours' }, { status: 403 });
        }
        // Publicise / adjust anonymity as part of the same save when asked.
        if (body.publicise !== undefined && user) {
            // Account-wide anonymity preference is the default unless the
            // request explicitly overrides it per build.
            const anonymous = body.anonymous !== undefined ? Boolean(body.anonymous) : await getAnonymousPreference();
            setBuildPublic(p.id, user.id, creatorToken, {
                isPublic: Boolean(body.publicise),
                anonymous,
                authorName: user.globalName || user.username,
                authorAvatar: user.avatar || null,
                summary,
            });
        }
        // savedToAccount tells the client the build is (now) attached to the
        // signed-in account — an anonymous row edited with its creator token
        // gets claimed onto the account by the update above.
        return NextResponse.json({ ok: true, savedToAccount: Boolean(user) });
    }

    // Publicise / de-publicise a build. Requires a signed-in Discord user who
    // owns the build (or holds the creator token of an anonymous row).
    if (body?.publicise !== undefined) {
        const sessionUser = await getDiscordUser();
        if (!sessionUser) {
            return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
        }
        const row = getBuild(p.id);
        if (!row) {
            return NextResponse.json({ error: 'build not found' }, { status: 404 });
        }
        const isPublic = Boolean(body.publicise);
        // Account-wide anonymity preference is the default unless the request
        // explicitly overrides it per build.
        const anonymous = body.anonymous !== undefined ? Boolean(body.anonymous) : await getAnonymousPreference();
        if (isPublic) {
            // Never surface builds whose name/notes carry blocked words.
            if (hasProfanity({ name: row.name, notes: row.notes, token: row.token, itemData: await getItemData() })) {
                return NextResponse.json({ error: 'profanity' }, { status: 400 });
            }
        }
        const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
        const summary = computeBuildSummary(row.token, itemData, skillsData);
        const creatorToken = request.cookies.get(`sts-build-owner-${p.id}`)?.value || null;
        const ok = setBuildPublic(p.id, sessionUser.id, creatorToken, {
            isPublic,
            anonymous,
            authorName: sessionUser.globalName || sessionUser.username,
            authorAvatar: sessionUser.avatar || null,
            summary,
        });
        if (!ok) {
            return NextResponse.json({ error: 'build not found or not yours' }, { status: 403 });
        }
        return NextResponse.json({ ok: true, isPublic, anonymous });
    }

    // Metadata-only update (name / notes) stays owner-only.
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const update = {};
    if (body?.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) {
            return NextResponse.json({ error: 'invalid name' }, { status: 400 });
        }
        update.name = name;
    }
    if (body?.notes !== undefined) {
        update.notes = typeof body.notes === 'string' ? body.notes : '';
    }
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }

    if (!updateBuild(p.id, user.id, update)) {
        return NextResponse.json({ error: 'build not found or not yours' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
    const p = await params;
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (!deleteBuild(p.id, user.id)) {
        return NextResponse.json({ error: 'build not found or not yours' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
