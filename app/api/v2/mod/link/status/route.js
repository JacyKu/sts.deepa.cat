import { NextResponse } from 'next/server';
import { getLinkByUuid } from '../../../../../../lib/sts-builds';

// Whether a Minecraft UUID is linked to a Discord account. The mod uses this
// to decide which buttons to show on the armoury page.
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid') || '';
    const link = getLinkByUuid(uuid);
    return NextResponse.json({ linked: Boolean(link) });
}
