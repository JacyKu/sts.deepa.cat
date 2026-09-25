import { compressedJsonResponse } from '../../../../../lib/compressed-json';
import { getItemData } from '../../../../_src/utils/itemsData';

// The full processed item database, fetched by the pages that need it
// client-side. The caller passes the content version (?v=<mtime>) and the
// response is immutable, so the browser (and Cloudflare) only fetch it again
// when the data actually changes - instead of shipping 3+ MB inside every
// page's HTML. Unversioned callers get a short cache. Compressed on the way
// out: the payload is megabytes of JSON (see lib/compressed-json.js).
export async function GET(request) {
    const items = await getItemData();
    const versioned = new URL(request.url).searchParams.has('v');
    return compressedJsonResponse(
        { items },
        {
            request,
            headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
        }
    );
}
