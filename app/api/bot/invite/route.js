import { NextResponse } from 'next/server';

// Builds the Discord bot install links from the site's OAuth application.
// Same application (STS_DISCORD_CLIENT_ID) as the login - the bot's
// register script prints the same URLs (see apps/discord-bot/src/register.js).
// Env-driven, so no code changes are needed between dev and production.
export const dynamic = 'force-dynamic';

export async function GET() {
    const clientId = process.env.STS_DISCORD_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'STS_DISCORD_CLIENT_ID not configured' }, { status: 503 });
    }
    const id = encodeURIComponent(clientId);
    return NextResponse.json({
        serverUrl: `https://discord.com/oauth2/authorize?client_id=${id}&scope=applications.commands`,
        userUrl: `https://discord.com/oauth2/authorize?client_id=${id}&scope=applications.commands&integration_type=1`,
    });
}
