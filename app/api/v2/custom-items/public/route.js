import { NextResponse } from 'next/server';
import { listPublicCustomItems, publicAuthorAvatar } from '../../../../../lib/sts-builds';
import { ITEM_TYPE_TOKEN_GROUPS } from '../../../../_src/utils/customItemTypes';

// Public custom items database listing:
// /api/v2/custom-items/public?q=&type=&sort=&page=&limit=
// No auth required - custom items are shareable, so the database is the
// browseable view of the same share links. `type` may also be an "All ..."
// token (ALL_MAINHANDS / ALL_MELEE_MAINHANDS / ALL_OFFHANDS), which is
// expanded to its concrete types before querying - same semantics as the
// items search's Item Type filter. `sort` is 'top' (most favourited) or
// 'new' (newest first).
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || null;
    const expanded = type && ITEM_TYPE_TOKEN_GROUPS[type] ? ITEM_TYPE_TOKEN_GROUPS[type] : null;
    const result = listPublicCustomItems({
        q: searchParams.get('q') || null,
        type: expanded ? null : type,
        types: expanded,
        sort: searchParams.get('sort') || 'top',
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '24',
    });
    // Discord account ids stay server-side: the avatar hash is resolved to a
    // full CDN URL for the listing instead.
    const items = result.items.map(({ userId, ...item }) => ({
        ...item,
        authorAvatar: publicAuthorAvatar(userId, item.authorAvatar),
    }));
    return NextResponse.json({ items, hasMore: result.hasMore, total: result.total });
}
