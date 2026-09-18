import { NextResponse } from 'next/server';
import { listSkillSetsByUser, saveSkillSet, SKILL_SET_KINDS, SKILL_SET_NAME_MAX } from '../../../../lib/sts-builds';
import { getDiscordUser } from '../../../../lib/session';
import { sanctionBlock } from '../../../../lib/moderation';
import { bodyTooLarge, tooLargeJson } from '../../../../lib/request-guards';

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
    // Banned/suspended accounts may browse but not save sets.
    const blocked = sanctionBlock(user);
    if (blocked) return blocked;
    if (!user) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (bodyTooLarge(request)) return tooLargeJson();
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
    const name = String(body.name || '')
        .trim()
        .slice(0, SKILL_SET_NAME_MAX);
    if (!name) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    // Payload is client-shaped data: bound its structure (depth, node count,
    // key/string lengths, numeric range) and keep it small so one crafted set
    // can't bloat the table or feed nonsense values into other users' builders.
    const payload = sanitizePayloadValue(body.payload, 0, { count: 0 });
    if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    const rawPayload = JSON.stringify(payload).slice(0, 50000);
    const className =
        kind === 'skills' && payload.cl && typeof payload.cl === 'string' ? payload.cl.slice(0, 30) : null;
    const spec = kind === 'skills' && payload.sp && typeof payload.sp === 'string' ? payload.sp.slice(0, 60) : null;
    const result = saveSkillSet({ userId: user.id, kind, name, payload: rawPayload, className, spec });
    if (!result) {
        return NextResponse.json({ error: 'could not save' }, { status: 400 });
    }
    return NextResponse.json({ id: result.id, isNew: result.isNew }, { status: result.isNew ? 201 : 200 });
}

const MAX_PAYLOAD_NODES = 500;
const MAX_PAYLOAD_DEPTH = 6;
const MAX_PAYLOAD_KEY_LENGTH = 64;
const MAX_PAYLOAD_STRING_LENGTH = 200;
const MAX_PAYLOAD_NUMBER = 10000;

// Returns the sanitized value, or undefined for entries that are dropped.
function sanitizePayloadValue(value, depth, budget) {
    if (budget.count > MAX_PAYLOAD_NODES) return undefined;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        return Number.isFinite(value) && Math.abs(value) <= MAX_PAYLOAD_NUMBER ? value : undefined;
    }
    if (typeof value === 'string') return value.slice(0, MAX_PAYLOAD_STRING_LENGTH);
    if (Array.isArray(value)) {
        if (depth >= MAX_PAYLOAD_DEPTH) return undefined;
        const out = [];
        for (const entry of value) {
            budget.count += 1;
            const clean = sanitizePayloadValue(entry, depth + 1, budget);
            if (clean !== undefined) out.push(clean);
        }
        return out;
    }
    if (typeof value === 'object') {
        if (depth >= MAX_PAYLOAD_DEPTH) return undefined;
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            budget.count += 1;
            if (typeof key !== 'string' || key.length > MAX_PAYLOAD_KEY_LENGTH) continue;
            const clean = sanitizePayloadValue(entry, depth + 1, budget);
            if (clean !== undefined) out[key] = clean;
        }
        return out;
    }
    return undefined;
}
