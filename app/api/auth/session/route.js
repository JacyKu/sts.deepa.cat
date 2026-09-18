import { NextResponse } from 'next/server';
import { getDiscordUser, getAnonymousPreference, resolveProfileAvatar } from '../../../../lib/session';
import { ensureStsUser, getStsUserCreatedAt, getActiveSanction } from '../../../../lib/sts-builds';
import { isModerator } from '../../../../lib/moderation';

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
    // Active sanction (ban/suspension): the client uses it for the banner and
    // to disable write actions; the API routes enforce it server-side.
    const sanction = user ? getActiveSanction(user.id) : null;
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
                  uploadedAvatars: avatar.uploadedAvatars,
                  anonymous,
                  stsCreatedAt: getStsUserCreatedAt(user.id),
                  isModerator: isModerator(user.id),
                  sanction: sanction
                      ? {
                            kind: sanction.kind,
                            reason: sanction.reason,
                            expiresAt: sanction.expires_at,
                        }
                      : null,
              }
            : null,
    });
}
