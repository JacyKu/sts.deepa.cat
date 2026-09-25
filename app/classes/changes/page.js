import { Suspense } from 'react';
import { getSkillsVersion, getClassHistoryVersion } from '../../_src/utils/itemsData';
import { ClassChangesDataView } from '../../_src/components/siteDataViews';
import ClassChangesSkeleton from '../../_src/components/classes/classChangesSkeleton';

export const metadata = {
    title: 'Monumenta Class Changes (Experimental)',
    description: 'New, removed and changed Monumenta classes, skills and specializations recorded from the API.',
    keywords: 'Monumenta, Minecraft, MMORPG, Classes, Skills, API, Changes, Nerfs, Buffs',
    openGraph: {
        title: 'Monumenta Class Changes (Experimental)',
        description: 'New, removed and changed Monumenta classes, skills and specializations recorded from the API.',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Monumenta Class Changes (Experimental)',
        description: 'New, removed and changed Monumenta classes, skills and specializations recorded from the API.',
        images: ['/favicon/favicon.png'],
    },
};

export default function Page() {
    return (
        <Suspense fallback={<ClassChangesSkeleton />}>
            <ChangesView />
        </Suspense>
    );
}

async function ChangesView() {
    const [skillsVersion, classHistoryVersion] = await Promise.all([getSkillsVersion(), getClassHistoryVersion()]);
    return <ClassChangesDataView skillsVersion={skillsVersion} classHistoryVersion={classHistoryVersion} />;
}
