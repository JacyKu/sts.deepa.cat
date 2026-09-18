import { notFound } from 'next/navigation';
import { getDiscordUser } from '../../lib/session';
import { isModerator } from '../../lib/moderation';
import ModerationPage from '../_src/components/moderationPage';

// Moderation tools are hidden from everyone else: non-moderators get a 404,
// and every /api/v2/moderation route checks the allowlist again server-side.
export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Moderation',
    robots: { index: false, follow: false },
};

export default async function Page() {
    const user = await getDiscordUser();
    if (!user || !isModerator(user.id)) notFound();
    return <ModerationPage moderator={user.globalName || user.username || ''} moderatorId={user.id} />;
}
