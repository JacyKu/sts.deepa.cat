import CustomItemsDatabasePage from '../../_src/components/customItems/customItemsDatabase';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Custom Items Database',
    description: 'Browse custom items shared by the community',
};

export default async function CustomItemsDatabase() {
    return <CustomItemsDatabasePage />;
}
