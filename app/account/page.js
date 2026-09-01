import AccountPage from '../_src/components/accountPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'My Account',
    description: 'Your STS account and linked Minecraft profiles',
};

export default function MyAccountPage() {
    return <AccountPage />;
}
