import BuildsPage from '../_src/components/buildsPage';
import { getBuildFilterData } from '../_src/utils/buildFilterData';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'My Builds',
    description: 'Your saved Monumenta builds',
};

export default async function MyBuildsPage() {
    const { classOptions, specMap, itemGroups } = await getBuildFilterData();
    return <BuildsPage classOptions={classOptions} specMap={specMap} itemGroups={itemGroups} />;
}