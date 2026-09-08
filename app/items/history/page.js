import { Suspense } from 'react';
import { getRawItems, getItemHistory } from '../../_src/utils/itemsData';
import HistoryPage from '../../_src/components/items/historyPage';
import ItemsSkeleton from '../../_src/components/itemsSkeleton';

export const metadata = {
    title: 'Monumenta Item Stat History',
    description: 'See how Monumenta item stats changed over time',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Item Guide, Nerfs, Buffs, History',
    openGraph: {
        title: 'Monumenta Item Stat History',
        description: 'See how Monumenta item stats changed over time',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta Item Stat History',
        description: 'See how Monumenta item stats changed over time',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return (
        <Suspense fallback={<ItemsSkeleton />}>
            <HistoryView />
        </Suspense>
    );
}

async function HistoryView() {
    const [itemData, history] = await Promise.all([getRawItems(), getItemHistory()]);
    return <HistoryPage itemData={itemData} history={history} />;
}
