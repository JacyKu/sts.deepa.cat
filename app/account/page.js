import AccountPage from '../_src/components/accountPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'My Account',
    description: 'Your account and linked Minecraft profiles',
    openGraph: {
        title: 'My Account',
        description: 'Your account and linked Minecraft profiles',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'My Account',
        description: 'Your account and linked Minecraft profiles',
        images: ['/favicon/favicon.png'],
    },
};

export default function MyAccountPage() {
    return <AccountPage />;
}
