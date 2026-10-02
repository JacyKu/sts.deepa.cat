import { compressedJsonResponse, stableWrapper } from '../../../../../lib/compressed-json';
import { getItemHistory } from '../../../../_src/utils/itemsData';

// The item stat-change archive (public/items/item-history.json). Versioned +
// immutable like the other data endpoints, and compressed/cached the same way.
export async function GET(request) {
    const history = await getItemHistory();
    const versioned = Boolean(new URL(request.url).searchParams.get('v'));
    return compressedJsonResponse(stableWrapper('history', history), {
        request,
        headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
    });
}
