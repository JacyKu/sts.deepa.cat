import { NextResponse } from 'next/server';
import { getDiscordUser, getAnonymousPreference, discordAvatarUrl } from '../../../../lib/session';
import { ensureStsUser, getStsUserCreatedAt } from '../../../../lib/sts-builds';

export async function GET() {
    const user = await getDiscordUser();
    const anonymous = await getAnonymousPreference();
    if (user) {
        // Sessions are stateless cookies; keep the account-creation date in
        // the database and register the account the first time it is seen.
        ensureStsUser(user.id);
    }
    return NextResponse.json({
        user: user
            ? {
                  id: user.id,
                  username: user.username,
                  globalName: user.globalName,
                  avatarUrl: discordAvatarUrl(user),
                  anonymous,
                  stsCreatedAt: getStsUserCreatedAt(user.id),
              }
            : null,
    });
}
