import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getItemData, getSkillsData } from '../_src/utils/itemsData';
import { getLinkPreviewTitle, getLinkPreviewDescription } from '../_src/utils/buildPreview';
import { mergeCustomItems } from '../../lib/sts-builds';
import { getDiscordUser } from '../../lib/session';
import BuilderPage from '../_src/components/builderPage';
import BuilderSkeleton from '../_src/components/builderSkeleton';

const keywords = 'Monumenta, Minecraft, MMORPG, Items, Builder';

export async function generateMetadata({ searchParams }) {
    const sp = await searchParams;
    const build = sp?.build ? String(sp.build) : null;

    if (!build) {
        return {
            title: 'Monumenta Builder',
            description: 'Monumenta build tool.',
            keywords,
            openGraph: {
                siteName: 'SPARE THE SYMPATHY',
                type: 'website',
                title: 'Monumenta Builder',
                images: [{ url: '/favicon/favicon.png' }],
            },
            twitter: {
                card: 'summary',
                title: 'Monumenta Builder',
                images: ['/favicon/favicon.png'],
            },
        };
    }

    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    const title = getLinkPreviewTitle(build, itemData, null, skillsData);
    const description = getLinkPreviewDescription(build, itemData, skillsData);
    const imageUrl = '/api/v1/og?build=' + encodeURIComponent(build);
    const requestHost = (await headers()).get('host') || 'deepa.cat';

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

export default async function Page({ searchParams }) {
    const sp = await searchParams;
    const build = sp?.build ? String(sp.build) : null;
    return (
        <Suspense fallback={<BuilderSkeleton />}>
            <BuilderView build={build} />
        </Suspense>
    );
}

async function BuilderView({ build }) {
    const itemData = await getItemData();
    const user = await getDiscordUser();
    return <BuilderPage build={build} itemData={mergeCustomItems(itemData, user ? user.id : null)} />;
}
