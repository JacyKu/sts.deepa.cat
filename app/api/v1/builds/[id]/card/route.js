import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getBuild } from '../../../../../../lib/sts-builds';
import { getBuildTokenVersion } from '../../../../../_src/utils/builder/buildUrlCodec';

// Public build card (used by the Discord bot):
//   /api/v1/builds/<id>/card
// Only PUBLIC builds are served - private or unknown builds 404, so the bot
// never leaks anything the site itself doesn't show.
//
// A signed-in owner can fetch their OWN private build card for the bot's
// /builds send command:
//   /api/v1/builds/<id>/card?user_id=<discord id>
//   Authorization: Bearer <STS_BOT_API_KEY>
// The bot passes the caller's own interaction user id, so ownership always
// means "the caller's own build".
export async function GET(request, { params }) {
    const p = await params;
    const row = getBuild(p.id);
    if (!row) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || '';
    if (row.is_public !== 1) {
        // Private build: only its owner may fetch it, and only via the bot
        // (holding the shared secret) on the caller's own behalf.
        if (!userId || String(row.user_id) !== String(userId)) {
            return NextResponse.json({ error: 'build is not public' }, { status: 404 });
        }
        const expected = process.env.STS_BOT_API_KEY;
        if (!expected) {
            return NextResponse.json({ error: 'not configured' }, { status: 503 });
        }
        const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        if (!auth || !timingSafeEqualStr(auth, expected)) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
    }

    let items = [];
    let skills = [];
    try {
        items = JSON.parse(row.items_json || '[]');
    } catch (e) {
        items = [];
    }
    try {
        skills = JSON.parse(row.skills_json || '[]');
    } catch (e) {
        skills = [];
    }

    const tokenVersion = getBuildTokenVersion(row.token) ?? '';
    return NextResponse.json({
        id: row.id,
        name: row.name,
        authorName: row.anonymous === 1 ? null : row.author_name,
        authorAvatar: row.anonymous === 1 ? null : row.author_avatar,
        class: row.class_name,
        spec: row.spec,
        region: row.region,
        power: row.power,
        hasCharms: row.has_charms === 1,
        masterworkCount: row.masterwork_count,
        charmCount: row.charm_count,
        ascension: row.ascension,
        enhancementCount: row.enhancement_count,
        skillPointCount: row.skill_point_count,
        itemCount: row.item_count,
        tree: row.cz_tree,
        items,
        skills,
        updatedAt: row.updated_at,
        url: `/b/v${tokenVersion}/${row.id}`,
    });
}

function timingSafeEqualStr(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
