import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getItemData, getSkillsData } from '../_src/utils/itemsData';
import { getLinkPreviewTitle, getLinkPreviewDescription, getSetPreviewDescription } from '../_src/utils/buildPreview';
import { mergeReferencedCustomItems, getPublicSkillSet } from '../../lib/sts-builds';
import { getBuildItemHashes } from '../_src/utils/builder/buildUrlCodec';
import { getDiscordUser } from '../../lib/session';
import BuilderPage from '../_src/components/builderPage';
import BuilderSkeleton from '../_src/components/builderSkeleton';

const keywords = 'Monumenta, Minecraft, MMORPG, Items, Builder';

export async function generateMetadata({ searchParams }) {
    const sp = await searchParams;
    const build = sp?.build ? String(sp.build) : null;

    // ?set=<id> imports a shared skill/infusion set into the builder; the
    // embed shows the set's skills through the build-card OG renderer.
    if (!build && sp?.set) {
        const set = getPublicSkillSet(String(sp.set));
        if (set) {
            const title = `${set.name} - Monumenta Builder`;
            const description = getSetPreviewDescription(set, await getSkillsData());
            const imageUrl = '/api/v1/og?set=' + encodeURIComponent(set.id);
            return {
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
    }

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
    const setId = sp?.set ? String(sp.set) : null;
    return (
        <Suspense fallback={<BuilderSkeleton />}>
            <BuilderView build={build} setId={setId} />
        </Suspense>
    );
}

async function BuilderView({ build, setId }) {
    const itemData = await getItemData();
    const user = await getDiscordUser();
    const hashes = getBuildItemHashes(build);
    const sharedSet = setId ? getPublicSkillSet(setId) : null;
    return (
        <BuilderPage
            build={build}
            sharedSet={sharedSet}
            itemData={mergeReferencedCustomItems(itemData, user ? user.id : null, hashes)}
        />
    );
}
