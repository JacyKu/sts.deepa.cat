import { Suspense } from 'react';
import { getItemData, getItemHistory } from '../_src/utils/itemsData';
import ItemsPage from '../_src/components/itemsPage';
import ItemsSkeleton from '../_src/components/itemsSkeleton';

export const metadata = {
    title: 'Monumenta Items',
    description: 'Monumenta item finder',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Item Guide',
    openGraph: {
        title: 'Monumenta Items',
        description: 'Monumenta item finder',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta Items',
        description: 'Monumenta item finder',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return (
        <Suspense fallback={<ItemsSkeleton />}>
            <ItemsView />
        </Suspense>
    );
}

async function ItemsView() {
    const [itemData, history] = await Promise.all([getItemData(), getItemHistory()]);
    // The stat history now renders inside the item tiles themselves. Removed
    // items have no tile, so their records stay on the API changes page only
    // (keeps the already large items payload from growing with dead items).
    const itemHistory = {};
    if (history && history.items) {
        for (const [key, records] of Object.entries(history.items)) {
            if (itemData[key] && Array.isArray(records) && records.length > 0) itemHistory[key] = records;
        }
    }
    return <ItemsPage itemData={itemData} itemHistory={itemHistory} />;
}
