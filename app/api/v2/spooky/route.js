import { NextResponse } from 'next/server';
import { getSpookyThemeState } from '../../../../lib/sts-builds';

// Public, tiny: lets pages that are already open notice the Spooky Month
// decorations being switched off (and the end of the one-day farewell)
// without a reload. The client polls it only while the decorations are on or
// the farewell prompt is still waiting, so the request stops once the event
// is over.
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(getSpookyThemeState(), {
        headers: { 'Cache-Control': 'no-store' },
    });
}
