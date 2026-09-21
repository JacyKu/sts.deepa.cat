import { NextResponse } from 'next/server';
import { getRawItems } from '../../../../_src/utils/itemsData';

// Raw (unprocessed) items.json for the API-changes page, which diffs the file
// against the recorded history by its original keys. Versioned + immutable
// like /api/v2/items/all.
export async function GET(request) {
    const items = await getRawItems();
    const versioned = new URL(request.url).searchParams.has('v');
    return NextResponse.json(
        { items },
        { headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300' } }
    );
}
