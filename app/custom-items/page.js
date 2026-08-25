import { Suspense } from 'react';
import { getItemData } from '../_src/utils/itemsData';
import { buildStatCategories } from '../_src/utils/items/statCategories';
import CustomItemsPage from '../_src/components/customItems/customItemsPage';

export const metadata = {
    title: 'Custom Items',
    description: 'Create custom Monumenta items with custom stats and a texture from the game',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Custom Item',
    openGraph: {
        title: 'Custom Items',
        description: 'Create custom Monumenta items with custom stats and a texture from the game',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Custom Items',
        description: 'Create custom Monumenta items with custom stats and a texture from the game',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return (
        <Suspense fallback={null}>
            <CustomItemsView />
        </Suspense>
    );
}

async function CustomItemsView() {
    const itemData = await getItemData();
    return <CustomItemsPage statCategories={buildStatCategories(itemData)} />;
}
