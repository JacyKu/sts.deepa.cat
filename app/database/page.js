import DatabasePage from '../_src/components/databasePage';
import { getBuildFilterData } from '../_src/utils/buildFilterData';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Build Database',
    description: 'Browse public Monumenta builds shared by the community',
};

export default async function Database() {
    const { classOptions, specMap, itemGroups } = await getBuildFilterData();
    return <DatabasePage classOptions={classOptions} specMap={specMap} itemGroups={itemGroups} />;
}