import LinkConfirmPage from '../../_src/components/linkConfirmPage';
import { getPendingLink } from '../../../lib/sts-builds';
import { getDiscordUser } from '../../../lib/session';
import { getMinecraftProfile, minecraftAvatarUrl } from '../../../lib/minecraft-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Link Minecraft profile',
    description: 'Link your Minecraft profile to your Discord account',
    openGraph: {
        title: 'Link Minecraft profile',
        description: 'Link your Minecraft profile to your Discord account',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Link Minecraft profile',
        description: 'Link your Minecraft profile to your Discord account',
        images: ['/favicon/favicon.png'],
    },
};

export default async function Page({ params }) {
    const { code } = await params;
    const pending = code && typeof code === 'string' ? getPendingLink(code) : null;
    const user = await getDiscordUser();
    let profile = null;
    if (pending) {
        const lookup = await getMinecraftProfile(pending.uuid);
        profile = lookup
            ? { name: lookup.name, avatarUrl: minecraftAvatarUrl(pending.uuid) }
            : { name: null, avatarUrl: minecraftAvatarUrl(pending.uuid) };
    }
    return <LinkConfirmPage code={String(code)} pending={pending} user={user} profile={profile} />;
}
