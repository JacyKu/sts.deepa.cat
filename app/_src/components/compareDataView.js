'use client';

// Client-side data view for the build comparison page. The heavy page is
// code-split with next/dynamic so it is not part of the route's first-load
// bundle; it only mounts once the item data has arrived.
import dynamic from 'next/dynamic';
import CompareSkeleton from './compareSkeleton';
import DataLoadError from './dataLoadError';
import { setSiteDataVersions, useSiteData } from '../utils/siteDataClient';

const ComparePage = dynamic(() => import('./comparePage'), {
    ssr: false,
    loading: () => <CompareSkeleton />,
});

export function CompareDataView({ itemsVersion }) {
    setSiteDataVersions({ items: itemsVersion });
    const { itemData, error } = useSiteData({ itemDataVersion: itemsVersion });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <CompareSkeleton />;
    return <ComparePage itemData={itemData} />;
}
