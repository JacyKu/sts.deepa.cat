import PollsPage from '../_src/components/pollsPage';

export const metadata = {
    title: 'Monumenta Update Name Polls',
    description: 'Vote on a name for the next Monumenta class update, or add your own.',
    keywords: 'Monumenta, Minecraft, MMORPG, Class updates, Polls, Voting',
    openGraph: {
        title: 'Monumenta Update Name Polls',
        description: 'Vote on a name for the next Monumenta class update, or add your own.',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta Update Name Polls',
        description: 'Vote on a name for the next Monumenta class update, or add your own.',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return <PollsPage />;
}
