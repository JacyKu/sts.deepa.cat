import SettingsPage from '../_src/components/settingsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Settings',
    description: 'Site look and behaviour settings, stored in your browser',
};

export default function Settings() {
    return <SettingsPage />;
}
