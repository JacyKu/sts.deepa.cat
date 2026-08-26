import { NextResponse } from 'next/server';
import { listBuildsByUser, getFavouriteState } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';
import { getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';

export async function GET() {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const builds = listBuildsByUser(user.id).map((b) => ({
        id: b.id,
        name: b.name || null,
        notes: b.notes || null,
        token: b.token,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
        state: b.parsedState,
        isPublic: b.is_public === 1,
        anonymous: b.anonymous === 1,
        class: b.class_name,
        spec: b.spec,
        region: b.region,
        power: b.power,
        hasCharms: b.has_charms === 1,
        masterworkCount: b.masterwork_count,
        charmCount: b.charm_count,
        ascension: b.ascension,
        enhancementCount: b.enhancement_count,
        skillPointCount: b.skill_point_count,
        itemCount: b.item_count,
        tree: b.cz_tree,
        skillsJson: b.skills_json,
        itemsJson: b.items_json,
        authorName: b.anonymous === 1 ? null : user.globalName || user.username,
        authorAvatar: b.anonymous === 1 ? null : user.avatar,
        authorId: b.anonymous === 1 ? null : user.id,
        myFavourite: false,
        favouriteCount: getFavouriteState(b.id, user.id).count,
        url: `/b/v${getBuildTokenVersion(b.token) ?? ''}/${b.id}`,
    }));
    return NextResponse.json({ builds });
}
