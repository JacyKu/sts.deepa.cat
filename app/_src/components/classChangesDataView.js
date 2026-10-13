'use client';

// Client-side data view for the class changes page. The heavy page is
// code-split with next/dynamic so it is not part of the route's first-load
// bundle; it only mounts once the class data has arrived.
import dynamic from 'next/dynamic';
import ClassChangesSkeleton from './classes/classChangesSkeleton';
import DataLoadError from './dataLoadError';
import { setSiteDataVersions, useClassChangesData } from '../utils/siteDataClient';

const ClassChangesPage = dynamic(() => import('./classes/classChangesPage'), {
    ssr: false,
    loading: () => <ClassChangesSkeleton />,
});

export function ClassChangesDataView({ skillsVersion, classHistoryVersion }) {
    setSiteDataVersions({ skills: skillsVersion });
    const { classData, history, error } = useClassChangesData({ skillsVersion, classHistoryVersion });
    if (error) return <DataLoadError message={error} />;
    if (!classData) return <ClassChangesSkeleton />;
    return <ClassChangesPage classData={classData} history={history} />;
}
