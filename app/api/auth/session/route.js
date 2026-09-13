import { NextResponse } from 'next/server';
import { getDiscordUser, getAnonymousPreference, resolveProfileAvatar } from '../../../../lib/session';
import { ensureStsUser, getStsUserCreatedAt } from '../../../../lib/sts-builds';

export async function GET() {
    const user = await getDiscordUser();
    const anonymous = await getAnonymousPreference();
    if (user) {
        // Sessions are stateless cookies; keep the account-creation date in
        // the database and register the account the first time it is seen.
        // The profile snapshot lets mod uploads use the Discord name/avatar.
        ensureStsUser(user.id, user);
    }
    const avatar = user ? resolveProfileAvatar(user) : null;
    return NextResponse.json({
        user: user
            ? {
                  id: user.id,
                  username: user.username,
                  globalName: user.globalName,
                  avatarUrl: avatar.avatarUrl,
                  avatarSource: avatar.avatarSource,
                  discordAvatarUrl: avatar.discordAvatarUrl,
                  minecraftAvatarUrl: avatar.minecraftAvatarUrl,
                  anonymous,
                  stsCreatedAt: getStsUserCreatedAt(user.id),
              }
            : null,
    });
}
