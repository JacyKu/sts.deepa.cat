import { Suspense } from 'react';
import { getItemDataVersion, getHistoryVersion } from '../_src/utils/itemsData';
import { ItemsDataView } from '../_src/components/siteDataViews';
import ItemsSkeleton from '../_src/components/itemsSkeleton';

export const metadata = {
    title: 'Monumenta Items',
    description: 'Search Monumenta items, including their stats and lore',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Item Guide',
    openGraph: {
        title: 'Monumenta Items',
        description: 'Search Monumenta items, including their stats and lore',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta Items',
        description: 'Search Monumenta items, including their stats and lore',
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
    // Only the data versions travel in the HTML; the item database itself is
    // fetched client-side and cached until the data changes.
    const [itemsVersion, historyVersion] = await Promise.all([getItemDataVersion(), getHistoryVersion()]);
    return <ItemsDataView itemsVersion={itemsVersion} historyVersion={historyVersion} />;
}
