'use client';

// Client-side data view: the page renders a small shell server-side and the
// big data files (item database, history) are fetched from the versioned,
// immutably cached API endpoints instead of being inlined into every page's
// HTML. The heavy items page is code-split with next/dynamic so it is not part
// of this route's first-load bundle; it only mounts once the data has arrived.
import dynamic from 'next/dynamic';
import ItemsSkeleton from './itemsSkeleton';
import DataLoadError from './dataLoadError';
import { useSiteData } from '../utils/siteDataClient';

const ItemsPage = dynamic(() => import('./itemsPage'), {
    ssr: false,
    loading: () => <ItemsSkeleton />,
});

export function ItemsDataView({ itemsVersion, historyVersion }) {
    const { itemData, history, error } = useSiteData({ itemDataVersion: itemsVersion, historyVersion });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <ItemsSkeleton />;
    // Removed items have no tile, so their records stay on the API changes
    // page only (keeps the already large items payload from growing).
    const itemHistory = {};
    for (const [key, records] of Object.entries((history && history.items) || {})) {
        if (itemData[key] && Array.isArray(records) && records.length > 0) itemHistory[key] = records;
    }
    return <ItemsPage itemData={itemData} itemHistory={itemHistory} />;
}
