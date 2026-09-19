import SettingsPage from '../_src/components/settingsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Settings',
    description: 'Site look and behaviour options, saved in your browser',
    openGraph: {
        title: 'Settings',
        description: 'Site look and behaviour options, saved in your browser',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Settings',
        description: 'Site look and behaviour options, saved in your browser',
        images: ['/favicon/favicon.png'],
    },
};

export default function Settings() {
    return <SettingsPage />;
}
