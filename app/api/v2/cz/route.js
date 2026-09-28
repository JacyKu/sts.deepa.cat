import { NextResponse } from 'next/server';
import { compressedJsonResponse } from '../../../../lib/compressed-json';
import { getCzData } from '../../../_src/utils/itemsData';

// Versioned by the caller (?v=<mtime>): immutable while the data is unchanged.
export async function GET(request) {
    try {
        const data = await getCzData();
        // The file failed to load (getCzData logs why): report it as
        // temporarily unavailable instead of crashing the route or serving
        // an empty payload the client would cache as real data.
        if (!data) return NextResponse.json({ error: 'cz ability data unavailable' }, { status: 503 });
        const versioned = new URL(request.url).searchParams.has('v');
        return compressedJsonResponse(data, {
            request,
            headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Unable to read czAbilities.json' }, { status: 500 });
    }
}
