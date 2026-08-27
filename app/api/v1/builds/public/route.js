import { NextResponse } from 'next/server';
import { listPublicBuilds } from '../../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../../lib/session';
import { getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';

// Public build database listing: /api/v1/builds/public?class=&region=&spec=&
// has_charms=&author=&q=&item=&skill=&sort=&page=&limit=
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const user = await getDiscordUser();

    const result = listPublicBuilds({
        class: searchParams.get('class') || null,
        region: searchParams.get('region') || null,
        spec: searchParams.get('spec') || null,
        hasCharms: searchParams.get('has_charms'),
        author: searchParams.get('author') || null,
        q: searchParams.get('q') || null,
        item: searchParams.get('item') || null,
        skill: searchParams.get('skill') || null,
        sort: searchParams.get('sort') || 'top',
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '24',
        userId: user ? user.id : null,
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
        favouriteCount: b.fav_count,
        myFavourite: Boolean(b.my_fav),
        updatedAt: b.updated_at,
        createdAt: b.created_at,
        url: `/b/v${getBuildTokenVersion(b.token) ?? ''}/${b.id}`,
    }));

    return NextResponse.json({ builds, hasMore: result.hasMore });
}
