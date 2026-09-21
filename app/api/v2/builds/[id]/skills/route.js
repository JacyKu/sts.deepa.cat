import { NextResponse } from 'next/server';
import { getBuild } from '../../../../../../lib/sts-builds';
import { getItemData } from '../../../../../_src/utils/itemsData';
import { skillsPayloadFromToken } from '../../../../../_src/utils/builder/buildSkills';

// Skills of a public build, for the builder's "copy skills" picker:
//   /api/v2/builds/<id>/skills
// The stored token is decoded here rather than in the browser, so public
// builds never expose their token. Only PUBLIC builds are served - private
// or unknown builds return the same 404, so this can't be used to probe
// which builds exist.
export async function GET(request, { params }) {
    const p = await params;
    const row = getBuild(p.id);
    if (!row || row.is_public !== 1) {
        return NextResponse.json({ error: 'build not found' }, { status: 404 });
    }

    const itemData = await getItemData();
    const payload = skillsPayloadFromToken(row.token, itemData);
    if (!payload) {
        return NextResponse.json({ error: 'build has no skills' }, { status: 404 });
    }

    return NextResponse.json({ id: row.id, name: row.name, payload });
}
