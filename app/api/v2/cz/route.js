import { NextResponse } from 'next/server';
import { getCzData } from '../../../_src/utils/itemsData';

// Versioned by the caller (?v=<mtime>): immutable while the data is unchanged.
export async function GET(request) {
    try {
        const data = await getCzData();
        const versioned = new URL(request.url).searchParams.has('v');
        return NextResponse.json(data, {
            headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Unable to read czAbilities.json' }, { status: 500 });
    }
}
