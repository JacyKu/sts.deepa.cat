import { NextResponse } from 'next/server';
import { listSkillSetsByUser, saveSkillSet, SKILL_SET_KINDS, SKILL_SET_NAME_MAX } from '../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../lib/session';

// Saved skill/delve sets are personal - Discord sign-in required (matches
// the builds API). GET lists the caller's sets; POST creates one (reusing
// the existing row when the name already exists for that kind, so names stay
// unique per user/kind, case-insensitive).
export async function GET() {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const kind = null; // both kinds; the client splits them
    return NextResponse.json({
        sets: listSkillSetsByUser(user.id, kind).map((s) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            className: s.class_name,
            spec: s.spec,
            payload: s.payload,
            isPublic: s.isPublic === true,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
        })),
    });
}

export async function POST(request) {
    const user = await getDiscordUser();
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }
    const kind = String(body.kind || '');
    if (!SKILL_SET_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }
    const name = String(body.name || '').trim().slice(0, SKILL_SET_NAME_MAX);
    if (!name) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    // Payload is JSON text the client produced; keep it small so one bad
    // client can't bloat the table.
    const rawPayload =
        body.payload && typeof body.payload === 'object' ? JSON.stringify(body.payload).slice(0, 50000) : null;
    if (!rawPayload) {
        return NextResponse.json({ error: 'payload required' }, { status: 400 });
    }
    const payload = safeParse(rawPayload);
    if (!payload) {
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    const className =
        kind === 'skills' && payload.cl && typeof payload.cl === 'string' ? payload.cl.slice(0, 30) : null;
    const spec = kind === 'skills' && payload.sp && typeof payload.sp === 'string' ? payload.sp.slice(0, 60) : null;
    const result = saveSkillSet({ userId: user.id, kind, name, payload: rawPayload, className, spec });
    if (!result) {
        return NextResponse.json({ error: 'could not save' }, { status: 400 });
    }
    return NextResponse.json({ id: result.id, isNew: result.isNew }, { status: result.isNew ? 201 : 200 });
}

function safeParse(text) {
    try {
        const value = JSON.parse(text);
        return value && typeof value === 'object' ? value : null;
    } catch (e) {
        return null;
    }
}
