import { Suspense } from 'react';
import { getCustomItem, getCustomItemFavouriteState, publicAuthorAvatar } from '../../../lib/sts-builds';
import { getDiscordUser } from '../../../lib/session';
import CustomItemPage from '../../_src/components/customItems/customItemView';
import CustomItemSkeleton from '../../_src/components/customItems/customItemSkeleton';

export const metadata = {
    title: 'Custom Item',
    description: 'A Monumenta custom item shared on the site',
    keywords: 'Monumenta, Minecraft, MMORPG, Items, Custom Item',
    openGraph: {
        title: 'Custom Item',
        description: 'A Monumenta custom item shared on the site',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Custom Item',
        description: 'A Monumenta custom item shared on the site',
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
    // Public items are share links anyone can view. Private items are only
    // visible to their owner - for everyone else they look missing.
    const isOwner = Boolean(user && item && item.userId === user.id);
    const visibleItem = item && (item.isPublic || isOwner) ? item : null;
    const favourite = visibleItem
        ? getCustomItemFavouriteState(id, user ? user.id : null)
        : { favourite: false, count: 0 };
    // The Discord account id never reaches the client (or the RSC payload):
    // the avatar is resolved server-side instead.
    let itemWithLikes = null;
    if (visibleItem) {
        const { userId, ...publicItem } = visibleItem;
        itemWithLikes = {
            ...publicItem,
            authorAvatar: publicAuthorAvatar(userId, publicItem.authorAvatar),
            favouriteCount: favourite.count,
            myFavourite: favourite.favourite,
        };
    }
    return <CustomItemPage item={itemWithLikes} isOwner={isOwner} loggedIn={Boolean(user)} />;
}
