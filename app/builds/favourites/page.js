import FavouritesPage from '../../_src/components/favouritesPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Favourites',
    description: 'Your favourited Monumenta builds',
    openGraph: {
        title: 'Favourites',
        description: 'Your favourited Monumenta builds',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Favourites',
        description: 'Your favourited Monumenta builds',
        images: ['/favicon/favicon.png'],
    },
};

export default function MyFavouritesPage() {
    return <FavouritesPage />;
}
