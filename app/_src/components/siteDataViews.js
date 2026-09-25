'use client';

// Client-side data views: the pages render a small shell server-side and the
// big data files (item database, history) are fetched from the versioned,
// immutably cached API endpoints instead of being inlined into every page's
// HTML. Repeat visits hit the browser cache, and the server no longer
// serializes megabytes per request.
import React from 'react';
import ItemsPage from './itemsPage';
import ItemsSkeleton from './itemsSkeleton';
import BuilderPage from './builderPage';
import BuilderSkeleton from './builderSkeleton';
import ApiChangesPage from './items/apiChangesPage';
import ApiChangesSkeleton from './items/apiChangesSkeleton';
import ClassChangesPage from './classes/classChangesPage';
import ClassChangesSkeleton from './classes/classChangesSkeleton';
import ComparePage from './comparePage';
import CompareSkeleton from './compareSkeleton';
import DataLoadError from './dataLoadError';
import { setSiteDataVersions, useSiteData, useClassChangesData } from '../utils/siteDataClient';

function mergeExtras(itemData, extraItems) {
    if (!extraItems || Object.keys(extraItems).length === 0) return itemData;
    return { ...itemData, ...extraItems };
}

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

export function BuilderDataView({ itemsVersion, skillsVersion, czVersion, extraItems, ...props }) {
    setSiteDataVersions({ items: itemsVersion, skills: skillsVersion, cz: czVersion });
    const { itemData, error } = useSiteData({ itemDataVersion: itemsVersion });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <BuilderSkeleton />;
    return <BuilderPage {...props} itemData={mergeExtras(itemData, extraItems)} />;
}

export function ApiChangesDataView({ itemsVersion, historyVersion }) {
    setSiteDataVersions({ items: itemsVersion });
    const { itemData, history, error } = useSiteData({ itemDataVersion: itemsVersion, historyVersion, raw: true });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <ApiChangesSkeleton />;
    return <ApiChangesPage itemData={itemData} history={history} />;
}

export function ClassChangesDataView({ skillsVersion, classHistoryVersion }) {
    setSiteDataVersions({ skills: skillsVersion });
    const { classData, history, error } = useClassChangesData({ skillsVersion, classHistoryVersion });
    if (error) return <DataLoadError message={error} />;
    if (!classData) return <ClassChangesSkeleton />;
    return <ClassChangesPage classData={classData} history={history} />;
}

export function CompareDataView({ itemsVersion }) {
    setSiteDataVersions({ items: itemsVersion });
    const { itemData, error } = useSiteData({ itemDataVersion: itemsVersion });
    if (error) return <DataLoadError message={error} />;
    if (!itemData) return <CompareSkeleton />;
    return <ComparePage itemData={itemData} />;
}
