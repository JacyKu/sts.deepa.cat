import { Suspense } from 'react';
import { getRawItems, getItemHistory } from '../../_src/utils/itemsData';
import ApiChangesPage from '../../_src/components/items/apiChangesPage';
import ApiChangesSkeleton from '../../_src/components/items/apiChangesSkeleton';

export const metadata = {
    title: 'Monumenta API Changes (Experimental)',
    description: 'Every Monumenta item API update: new items, removed items and stat changes. Experimental feature.',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, API, Changes, Nerfs, Buffs',
    openGraph: {
        title: 'Monumenta API Changes (Experimental)',
        description: 'Every Monumenta item API update: new items, removed items and stat changes. Experimental feature.',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta API Changes (Experimental)',
        description: 'Every Monumenta item API update: new items, removed items and stat changes. Experimental feature.',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return (
        <Suspense fallback={<ApiChangesSkeleton />}>
            <ChangesView />
        </Suspense>
    );
}

async function ChangesView() {
    const [itemData, history] = await Promise.all([getRawItems(), getItemHistory()]);
    return <ApiChangesPage itemData={itemData} history={history} />;
}
