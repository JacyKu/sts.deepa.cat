import { Suspense } from 'react';
import { getItemData } from '../_src/utils/itemsData';
import ComparePage from '../_src/components/comparePage';
import CompareSkeleton from '../_src/components/compareSkeleton';

export const metadata = {
    title: 'Build Comparison (Experimental)',
    description: 'Compare two Monumenta builds side by side: stats, items and charms. Experimental feature.',
    openGraph: {
        siteName: 'SPARE THE SYMPATHY',
        type: 'website',
        title: 'Build Comparison (Experimental)',
        images: [{ url: '/favicon/favicon.png' }],
    },
};

export default async function Page() {
    const itemData = await getItemData();
    return (
        <Suspense fallback={<CompareSkeleton />}>
            <ComparePage itemData={itemData} />
        </Suspense>
    );
}
