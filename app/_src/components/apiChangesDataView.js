'use client';

// Client-side data view for the API changes page. The heavy page is
// code-split with next/dynamic so it is not part of the route's first-load
// bundle; it only mounts once the item data has arrived.
import dynamic from 'next/dynamic';
import ApiChangesSkeleton from './items/apiChangesSkeleton';
import DataLoadError from './dataLoadError';
import { setSiteDataVersions, useSiteData } from '../utils/siteDataClient';

const ApiChangesPage = dynamic(() => import('./items/apiChangesPage'), {
    ssr: false,
    loading: () => <ApiChangesSkeleton />,
});

export function ApiChangesDataView({ itemsVersion, historyVersion }) {
    setSiteDataVersions({ items: itemsVersion });
    const { itemData, history, error } = useSiteData({ itemDataVersion: itemsVersion, historyVersion, raw: true });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <ApiChangesSkeleton />;
    return <ApiChangesPage itemData={itemData} history={history} />;
}
