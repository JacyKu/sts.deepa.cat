import { NextResponse } from 'next/server';
import { getSkillsData } from '../../../_src/utils/itemsData';

export async function GET() {
    try {
        const skills = await getSkillsData();
        return NextResponse.json(skills);
    } catch (e) {
        return NextResponse.json({ error: 'Unable to read skills.json' }, { status: 500 });
    }
}
