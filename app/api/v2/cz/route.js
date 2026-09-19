import { NextResponse } from 'next/server';
import { getCzData } from '../../../_src/utils/itemsData';

export async function GET() {
    try {
        const data = await getCzData();
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Unable to read czAbilities.json' }, { status: 500 });
    }
}
