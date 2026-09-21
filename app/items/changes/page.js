import { Suspense } from 'react';
import { getItemDataVersion, getHistoryVersion } from '../../_src/utils/itemsData';
import { ApiChangesDataView } from '../../_src/components/siteDataViews';
import ApiChangesSkeleton from '../../_src/components/items/apiChangesSkeleton';

export const metadata = {
    title: 'Monumenta API Changes (Experimental)',
    description: 'New, removed and changed Monumenta items recorded from the API. Experimental feature.',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, API, Changes, Nerfs, Buffs',
    openGraph: {
        title: 'Monumenta API Changes (Experimental)',
        description: 'New, removed and changed Monumenta items recorded from the API. Experimental feature.',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta API Changes (Experimental)',
        description: 'New, removed and changed Monumenta items recorded from the API. Experimental feature.',
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
    const [itemsVersion, historyVersion] = await Promise.all([getItemDataVersion(), getHistoryVersion()]);
    return <ApiChangesDataView itemsVersion={itemsVersion} historyVersion={historyVersion} />;
}
