import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getItemData, getItemDataVersion, getSkillsData, getSkillsVersion, getCzVersion } from '../../_src/utils/itemsData';
import { getLinkPreviewTitle, getLinkPreviewDescription } from '../../_src/utils/buildPreview';
import { referencedCustomItemExtras } from '../../../lib/sts-builds';
import { getBuildItemHashes } from '../../_src/utils/builder/buildUrlCodec';
import { getDiscordUser } from '../../../lib/session';
import { BuilderDataView } from '../../_src/components/siteDataViews';
import BuilderSkeleton from '../../_src/components/builderSkeleton';

const keywords = 'Monumenta, Minecraft, MMORPG, Items, Builder';

export async function generateMetadata({ params }) {
    const p = await params;
    const build = p?.build ? String(p.build).replace(/,/g, '/') : null;

    if (!build) {
        return {
            title: 'Monumenta Builder',
            description: 'Make and share Monumenta builds.',
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
    const imageUrl = '/api/v2/og?build=' + encodeURIComponent(build);
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

export default async function Page({ params }) {
    const p = await params;
    const build = p?.build ? String(p.build).replace(/,/g, '/') : null;
    return (
        <Suspense fallback={<BuilderSkeleton />}>
            <BuilderView build={build} />
        </Suspense>
    );
}

async function BuilderView({ build }) {
    const user = await getDiscordUser();
    const hashes = getBuildItemHashes(build);
    const [itemsVersion, skillsVersion, czVersion, extraItems] = await Promise.all([
        getItemDataVersion(),
        getSkillsVersion(),
        getCzVersion(),
        getItemData().then((itemData) => referencedCustomItemExtras(itemData, user ? user.id : null, hashes)),
    ]);
    return (
        <BuilderDataView
            build={build}
            itemsVersion={itemsVersion}
            skillsVersion={skillsVersion}
            czVersion={czVersion}
            extraItems={extraItems}
        />
    );
}
