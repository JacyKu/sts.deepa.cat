import { NextResponse } from 'next/server';
import { applySanction, liftSanction, SANCTION_KINDS } from '../../../../../../../lib/sts-builds';
import { requireModerator } from '../../../../../../../lib/moderation';

// Moderator-only sanctions:
//   POST   { kind: 'ban' | 'suspend', reason?, expiresAt? } -> apply/replace
//   DELETE -> lift the sanction
// A suspension without an expiry lasts until it is lifted.
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
    const { user: moderator, error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    if (id === moderator.id) {
        return NextResponse.json({ error: 'cannot sanction yourself' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const kind = body && typeof body.kind === 'string' ? body.kind : '';
    if (!SANCTION_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }
    const reason = body && typeof body.reason === 'string' ? body.reason : null;
    const expiresAt = body && typeof body.expiresAt === 'string' ? body.expiresAt : null;
    if (kind === 'suspend' && expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
        return NextResponse.json({ error: 'invalid expiry' }, { status: 400 });
    }

    const sanction = applySanction({
        discordId: id,
        kind,
        reason,
        expiresAt,
        createdBy: moderator.id,
    });
    if (!sanction) {
        return NextResponse.json({ error: 'could not save the sanction' }, { status: 400 });
    }
    return NextResponse.json({ sanction }, { status: 201 });
}

export async function DELETE(_request, { params }) {
    const { user: moderator, error } = await requireModerator();
    if (error) return error;
    const { id } = await params;
    // A moderator who is sanctioned cannot reach this handler (requireModerator
    // refuses sanctioned accounts), but block self-lift explicitly so the rule
    // survives any future change to that guard: only a different moderator may
    // lift your sanction.
    if (id === moderator.id) {
        return NextResponse.json({ error: 'cannot lift your own sanction' }, { status: 400 });
    }
    return NextResponse.json({ ok: liftSanction(id) });
}
