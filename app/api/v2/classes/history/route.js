import { NextResponse } from 'next/server';
import { getClassHistory } from '../../../../_src/utils/itemsData';

// The class/skill/spec change archive (public/items/class-history.json).
// Versioned + immutable like the other data endpoints.
export async function GET(request) {
    const history = await getClassHistory();
    const versioned = new URL(request.url).searchParams.has('v');
    return NextResponse.json(
        { history },
        { headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' } }
    );
}
