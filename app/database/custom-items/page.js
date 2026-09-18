import CustomItemsDatabasePage from '../../_src/components/customItems/customItemsDatabase';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Custom Items Database',
    description: 'Browse public custom items',
    openGraph: {
        title: 'Custom Items Database',
        description: 'Browse public custom items',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Custom Items Database',
        description: 'Browse public custom items',
        images: ['/favicon/favicon.png'],
    },
};

export default async function CustomItemsDatabase() {
    return <CustomItemsDatabasePage />;
}
