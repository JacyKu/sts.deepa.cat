import { Suspense } from 'react';
import { getItemDataVersion } from '../_src/utils/itemsData';
import { CompareDataView } from '../_src/components/siteDataViews';
import CompareSkeleton from '../_src/components/compareSkeleton';

export const metadata = {
    title: 'Build Comparison (Experimental)',
    description: 'Compare two Monumenta builds: stats, items and charms. Experimental feature.',
    openGraph: {
        siteName: 'SPARE THE SYMPATHY',
        type: 'website',
        title: 'Build Comparison (Experimental)',
        description: 'Compare two Monumenta builds: stats, items and charms. Experimental feature.',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Build Comparison (Experimental)',
        description: 'Compare two Monumenta builds: stats, items and charms. Experimental feature.',
        images: ['/favicon/favicon.png'],
    },
};

export default async function Page() {
    const itemsVersion = await getItemDataVersion();
    return (
        <Suspense fallback={<CompareSkeleton />}>
            <CompareDataView itemsVersion={itemsVersion} />
        </Suspense>
    );
}
