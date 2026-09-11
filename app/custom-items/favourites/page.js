import CustomItemsFavouritesPage from '../../_src/components/customItems/customItemsFavouritesPage';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Favourite Custom Items',
    description: 'Your favourite Monumenta custom items',
};

export default function Page() {
    return <CustomItemsFavouritesPage />;
}
