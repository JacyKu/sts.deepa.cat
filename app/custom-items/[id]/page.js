import { Suspense } from 'react';
import { getCustomItem, getCustomItemFavouriteState } from '../../../lib/sts-builds';
import { getDiscordUser } from '../../../lib/session';
import CustomItemPage from '../../_src/components/customItems/customItemView';
import CustomItemSkeleton from '../../_src/components/customItems/customItemSkeleton';

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
        <Suspense fallback={<CustomItemSkeleton />}>
            <CustomItemView params={params} />
        </Suspense>
    );
}

async function CustomItemView({ params }) {
    const { id } = await params;
    const [item, user] = await Promise.all([getCustomItem(id), getDiscordUser()]);
    // Share links are public: anyone with the link sees the item. Only the
    // owner can manage it, and only logged-in visitors can copy it.
    const isOwner = Boolean(user && item && item.userId === user.id);
    const favourite = item ? getCustomItemFavouriteState(id, user ? user.id : null) : { favourite: false, count: 0 };
    const itemWithLikes = item ? { ...item, favouriteCount: favourite.count, myFavourite: favourite.favourite } : null;
    return <CustomItemPage item={itemWithLikes} isOwner={isOwner} loggedIn={Boolean(user)} />;
}
