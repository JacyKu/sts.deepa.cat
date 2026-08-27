import { NextResponse } from 'next/server';
import { listFavouriteBuilds } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';
import { getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';

// The signed-in user's favourited builds (paged).
export async function GET(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const result = listFavouriteBuilds({
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '24',
        userId: user.id,
    });

    const builds = result.builds.map((b) => ({
        id: b.id,
        name: b.name || null,
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
        authorName: b.anonymous === 1 ? null : b.author_name,
        authorAvatar: b.anonymous === 1 ? null : b.author_avatar,
        authorId: b.anonymous === 1 ? null : b.user_id,
        isPublic: b.is_public === 1,
        favouriteCount: b.fav_count,
        myFavourite: true,
        updatedAt: b.updated_at,
        createdAt: b.created_at,
        url: `/b/v${getBuildTokenVersion(b.token) ?? ''}/${b.id}`,
    }));

    return NextResponse.json({ builds, hasMore: result.hasMore });
}
