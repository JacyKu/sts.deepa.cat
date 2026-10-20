'use client';

// Client-side data view for the builder and the saved-build links (/b/<id>).
// The heavy builder page is code-split with next/dynamic so it is not part of
// the route's first-load bundle; it only mounts once the item data has arrived.
import dynamic from 'next/dynamic';
import BuilderSkeleton from './builderSkeleton';
import DataLoadError from './dataLoadError';
import { setSiteDataVersions, useSiteData } from '../utils/siteDataClient';

const BuilderPage = dynamic(() => import('./builderPage'), {
    ssr: false,
    loading: () => <BuilderSkeleton />,
});

function mergeExtras(itemData, extraItems) {
    if (!extraItems || Object.keys(extraItems).length === 0) return itemData;
    return { ...itemData, ...extraItems };
}

export function BuilderDataView({ itemsVersion, skillsVersion, czVersion, extraItems, ...props }) {
    setSiteDataVersions({ items: itemsVersion, skills: skillsVersion, cz: czVersion });
    const { itemData, error } = useSiteData({ itemDataVersion: itemsVersion });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <BuilderSkeleton />;
    return <BuilderPage {...props} itemData={mergeExtras(itemData, extraItems)} />;
}
