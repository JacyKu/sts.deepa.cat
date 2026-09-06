import { Suspense } from 'react';
import { getCustomItem } from '../../../lib/sts-builds';
import { getDiscordUser } from '../../../lib/session';
import CustomItemPage from '../../_src/components/customItems/customItemView';

export const metadata = {
    title: 'Custom Item',
    description: 'A shared custom Monumenta item',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Custom Item',
    openGraph: {
        title: 'Custom Item',
        description: 'A shared custom Monumenta item',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Custom Item',
        description: 'A shared custom Monumenta item',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page({ params }) {
    return (
        <Suspense fallback={null}>
            <CustomItemView params={params} />
        </Suspense>
    );
}

async function CustomItemView({ params }) {
    const { id } = await params;
    const [item, user] = await Promise.all([getCustomItem(id), getDiscordUser()]);
    // Custom items are private to their creator: only the owner gets the
    // item data. Everyone else sees the plain "not found" state.
    const isOwner = Boolean(user && item && item.userId === user.id);
    return <CustomItemPage item={isOwner ? item : null} isOwner={isOwner} />;
}