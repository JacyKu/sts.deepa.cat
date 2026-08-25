import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { listBuildsByUser } from '../../../../../lib/sts-builds';
import { getBuildTokenVersion } from '../../../../_src/utils/builder/buildUrlCodec';

// Bot-only: the Discord bot lists a linked user's builds.
//   GET /api/v1/builds/by-user?discord_id=...
//   Authorization: Bearer <STS_BOT_API_KEY>
//
// The bot verifies the caller's Discord identity through its own OAuth flow
// (/link); Discord user ids are global, so discord_id is the same id the
// site's login stores on the builds. Only the bot, holding the shared secret
// (STS_BOT_API_KEY, same value set on the bot server), may ask - nobody else
// can enumerate another user's builds.
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const discordId = searchParams.get('discord_id') || '';
    if (!/^[0-9]+$/.test(discordId)) {
        return NextResponse.json({ error: 'invalid discord_id' }, { status: 400 });
    }

    const expected = process.env.STS_BOT_API_KEY;
    if (!expected) {
        return NextResponse.json({ error: 'not configured' }, { status: 503 });
    }
    const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!auth || !timingSafeEqualStr(auth, expected)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const builds = listBuildsByUser(discordId).map((b) => ({
        id: b.id,
        name: b.name || null,
        class: b.class_name,
        spec: b.spec,
        region: b.region,
        power: b.power,
        isPublic: b.is_public === 1,
        masterworkCount: b.masterwork_count,
        charmCount: b.charm_count,
        itemCount: b.item_count,
        updatedAt: b.updated_at,
        createdAt: b.created_at,
        url: `/b/v${getBuildTokenVersion(b.token) ?? ''}/${b.id}`,
    }));

    return NextResponse.json({ builds });
}

function timingSafeEqualStr(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
