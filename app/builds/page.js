import BuildsPage from '../_src/components/buildsPage';
import { getBuildFilterData } from '../_src/utils/buildFilterData';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'My Builds',
    description: 'Your saved Monumenta builds',
    openGraph: {
        title: 'My Builds',
        description: 'Your saved Monumenta builds',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'My Builds',
        description: 'Your saved Monumenta builds',
        images: ['/favicon/favicon.png'],
    },
};

export default async function MyBuildsPage() {
    const { classOptions, specMap, itemGroups, skillOptions, skillMap } = await getBuildFilterData();
    return (
        <BuildsPage
            classOptions={classOptions}
            specMap={specMap}
            itemGroups={itemGroups}
            skillOptions={skillOptions}
            skillMap={skillMap}
        />
    );
}
