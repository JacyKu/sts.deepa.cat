import { NextResponse } from 'next/server';
import { listUpdateNames } from '../../../../lib/polls';

// GET /api/v2/update-names -> { names: { class: { <runAt>: name }, api: {...} } }
//
// The display names chosen by closed name polls, keyed by the update run's
// timestamp. The class/API changes pages fetch this to label each run with its
// community-chosen title.
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ names: listUpdateNames() });
}
