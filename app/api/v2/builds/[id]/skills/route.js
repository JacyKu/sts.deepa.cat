import { NextResponse } from 'next/server';
import { getBuild } from '../../../../../../lib/sts-builds';
import { getItemData } from '../../../../../_src/utils/itemsData';
import { skillsPayloadFromToken } from '../../../../../_src/utils/builder/buildSkills';

// Share links are viewable by link even when the build is not listed.
export const dynamic = 'force-dynamic';

// Skills of a build, for the builder's "copy skills" picker and the mod's
// in-game skill picker:
//   /api/v2/builds/<id>/skills
// The stored token is decoded here rather than in the browser, so the token
// itself is never exposed. Private builds are not listed in the public
// database, but their share links are viewable by anyone, so the skill
// portion is served for any existing id. Unknown ids still return 404.
export async function GET(request, { params }) {
    const p = await params;
    const row = getBuild(p.id);
    if (!row) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }

    const itemData = await getItemData();
    const payload = skillsPayloadFromToken(row.token, itemData);
    if (!payload) {
        return NextResponse.json({ error: 'build has no skills' }, { status: 404 });
    }

    return NextResponse.json({ id: row.id, name: row.name, payload });
}
