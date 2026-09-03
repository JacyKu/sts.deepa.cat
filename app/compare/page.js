import { Suspense } from 'react';
import { getItemData } from '../_src/utils/itemsData';
import ComparePage from '../_src/components/comparePage';

export const metadata = {
    title: 'Build Comparison',
    description: 'Compare two Monumenta builds side by side: stats, items and charms.',
    openGraph: {
        siteName: 'SPARE THE SYMPATHY',
        type: 'website',
        title: 'Build Comparison',
        images: [{ url: '/favicon/favicon.png' }],
    },
};

export default async function Page() {
    const itemData = await getItemData();
    return (
        <Suspense fallback={null}>
            <ComparePage itemData={itemData} />
        </Suspense>
    );
}
