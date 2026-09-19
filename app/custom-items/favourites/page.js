import CustomItemsFavouritesPage from '../../_src/components/customItems/customItemsFavouritesPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Favourite Custom Items',
    description: 'Your favourite Monumenta custom items',
    openGraph: {
        title: 'Favourite Custom Items',
        description: 'Your favourite Monumenta custom items',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Favourite Custom Items',
        description: 'Your favourite Monumenta custom items',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return <CustomItemsFavouritesPage />;
}
