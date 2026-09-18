import DatabasePage from '../_src/components/databasePage';
import { getBuildFilterData } from '../_src/utils/buildFilterData';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Build Database',
    description: 'Browse public Monumenta builds',
    openGraph: {
        title: 'Build Database',
        description: 'Browse public Monumenta builds',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Build Database',
        description: 'Browse public Monumenta builds',
        images: ['/favicon/favicon.png'],
    },
};

export default async function Database() {
    const { classOptions, specMap, itemGroups, skillOptions, skillMap } = await getBuildFilterData();
    return (
        <DatabasePage
            classOptions={classOptions}
            specMap={specMap}
            itemGroups={itemGroups}
            skillOptions={skillOptions}
            skillMap={skillMap}
        />
    );
}
