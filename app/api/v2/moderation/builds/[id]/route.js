import { NextResponse } from 'next/server';
import {
    getBuild,
    deleteBuildAsModerator,
    setBuildPublicAsModerator,
    preferredAuthorAvatar,
    getStsUserProfile,
} from '../../../../../../lib/sts-builds';
import { computeBuildSummary, hasProfanity } from '../../../../../../lib/public-builds';
import { getItemData, getSkillsData } from '../../../../../_src/utils/itemsData';
import { requireModerator } from '../../../../../../lib/moderation';

// Moderator-only build actions:
//   PATCH  { isPublic } -> force the build public/private
//   DELETE              -> remove the build (and its favourite rows)
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
    const { error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    const row = getBuild(id);
    if (!row) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body.isPublic !== 'boolean') {
        return NextResponse.json({ error: 'isPublic is required' }, { status: 400 });
    }

    const isPublic = body.isPublic;
    if (!isPublic) {
        const ok = setBuildPublicAsModerator(id, false, { anonymous: row.anonymous === 1 });
        return NextResponse.json({ ok, isPublic: false });
    }

    // Publishing must pass the same profanity gate as the owner flow, and the
    // stored snapshot/filter columns are refreshed so the database listing is
    // complete even for builds that were never publicised before.
    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    if (hasProfanity({ name: row.name, notes: row.notes, token: row.token, itemData })) {
        return NextResponse.json({ error: 'profanity' }, { status: 400 });
    }
    let summary = null;
    try {
        summary = computeBuildSummary(row.token, itemData, skillsData);
    } catch (e) {
        // Undecodable legacy token: keep the stored snapshot, still flip the flag.
        summary = null;
    }
    const profile = row.user_id ? getStsUserProfile(row.user_id) : null;
    const ok = setBuildPublicAsModerator(id, true, {
        anonymous: row.anonymous === 1,
        authorName: row.author_name || (profile ? profile.name : null),
        authorAvatar: row.author_avatar || (row.user_id ? preferredAuthorAvatar(row.user_id) : null),
        summary: summary || undefined,
    });
    return NextResponse.json({ ok, isPublic: true });
}

export async function DELETE(_request, { params }) {
    const { error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    const ok = deleteBuildAsModerator(id);
    if (!ok) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
