import { NextResponse } from 'next/server';
import { getDiscordUser, getAnonymousPreference, discordAvatarUrl } from '../../../../lib/session';

export async function GET() {
    const user = await getDiscordUser();
    const anonymous = await getAnonymousPreference();
    return NextResponse.json({
        user: user
            ? {
                  id: user.id,
                  username: user.username,
                  globalName: user.globalName,
                  avatarUrl: discordAvatarUrl(user),
                  anonymous,
              }
            : null,
    });
}
