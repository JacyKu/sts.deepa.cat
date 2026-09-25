import { NextResponse } from 'next/server';
import { compressedJsonResponse } from '../../../../lib/compressed-json';
import { getSkillsData } from '../../../_src/utils/itemsData';

// Versioned by the caller (?v=<mtime>): immutable while the data is unchanged.
// Unversioned callers (older clients) get a short cache instead of a stale one.
// Over a megabyte of JSON, so it is compressed on the way out.
export async function GET(request) {
    try {
        const skills = await getSkillsData();
        const versioned = new URL(request.url).searchParams.has('v');
        return compressedJsonResponse(skills, {
            request,
            headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Unable to read skills.json' }, { status: 500 });
    }
}
