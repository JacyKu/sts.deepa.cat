import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { getBuild, mergeCustomItems } from '../../../lib/sts-builds';
import { getDiscordUser } from '../../../lib/session';
import { getItemData, getSkillsData } from '../utils/itemsData';
import { getLinkPreviewTitle, getLinkPreviewDescription } from '../utils/buildPreview';
import BuilderPage from './builderPage';
import { stsBaseForHost } from '../utils/base';

export const dynamic = 'force-dynamic';

const keywords = 'Monumenta, Minecraft, MMORPG, Items, Builder';

// Shared metadata + page for /b/<id> and /b/v<version>/<id>. The version
// segment is informational (the token carries its own version byte); we just
// check it looks like "v<digits>" and prefer the canonical form when the
// stored token disagrees.
export async function buildLinkMetadata(id) {
    const row = getBuild(id);
    if (!row) {
        return { title: 'Monumenta Builder' };
    }

    const headersList = await headers();
    const requestHost = headersList.get('host') || 'deepa.cat';
    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    const title = row.name || getLinkPreviewTitle(row.token, itemData, null, skillsData);
    const description = getLinkPreviewDescription(row.token, itemData, skillsData, row.parsedState?.infusions);
    // The DB-backed image carries the delve infusions, which the token alone can't.
    // The &v cache-buster (the row's updated_at + publicized_at) changes on
    // every edit and on publicise/anonymity changes, so Discord fetches a fresh
    // image instead of serving its cached embed (e.g. the author bar).
    const imageUrl = '/api/v1/og?id=' + id + '&v=' + encodeURIComponent((row.updated_at || '') + '|' + (row.publicized_at || ''));

    return {
        metadataBase: new URL('https://' + requestHost),
        title,
        description,
        keywords,
        openGraph: {
            siteName: 'SPARE THE SYMPATHY',
            type: 'website',
            title,
            description,
            images: [{ url: imageUrl, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
    };
}

export async function BuildLinkPageView(id) {
    const row = getBuild(id);

    const headersList = await headers();
    const base = stsBaseForHost(headersList.get('host') || '');

    if (!row) {
        redirect(base + '/builder');
    }

    const user = await getDiscordUser();
    const itemData = mergeCustomItems(await getItemData(), user ? user.id : null);
    // The build opens in place; saves update the DB row, they don't rewrite URLs.
    const isOwner = Boolean(user && row.user_id && user.id === row.user_id);
    // Anonymous rows are editable + publicisable by whoever holds their
    // creator cookie (the browser that created them), even after logging in.
    const cookieStore = await cookies();
    const creatorToken = cookieStore.get(`sts-build-owner-${id}`)?.value || null;
    const isCreator = Boolean(user && !row.user_id && creatorToken);
    return (
        <BuilderPage
            build={row.token}
            itemData={itemData}
            savedState={row.parsedState}
            savedName={row.name}
            notes={row.notes}
            canEditNotes={isOwner || isCreator}
            buildId={id}
            canPublicise={isOwner || isCreator}
            isPublic={row.is_public === 1}
            isAnonymous={row.anonymous === 1}
        />
    );
}
