import { NextResponse } from 'next/server';
import { getItemHistory } from '../../../../_src/utils/itemsData';

// The item stat-change archive (public/items/item-history.json). Versioned +
// immutable like the other data endpoints.
export async function GET(request) {
    const history = await getItemHistory();
    const versioned = new URL(request.url).searchParams.has('v');
    return NextResponse.json(
        { history },
        { headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' } }
    );
}
