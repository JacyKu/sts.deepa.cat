import { getPublicSkillSet } from '../../../lib/sts-builds';
import { getSkillsData } from '../../_src/utils/itemsData';
import SharedSetView from '../../_src/components/sets/sharedSetView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const set = getPublicSkillSet(id);
    const title = set ? `${set.name} · Shared set` : 'Shared set';
    const description = set
        ? set.kind === 'delve'
            ? 'A shared delve infusion set for the Monumenta builder.'
            : 'A shared skill set for the Monumenta builder.'
        : 'A shared skill or infusion set.';
    return {
        title,
        description,
        openGraph: {
            siteName: 'SPARE THE SYMPATHY',
            type: 'website',
            title,
            description,
            images: [{ url: '/favicon/favicon.png' }],
        },
        twitter: {
            card: 'summary',
            title,
            description,
            images: ['/favicon/favicon.png'],
        },
    };
}

const SLOTS = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];

// Maps a skill set's scoreboard-id payload onto display names using the
// public skills data, so the page can render server-side and ship only the
// small display rows to the client.
function buildSkillDetail(set, skillsData) {
    const payload = set.payload || {};
    const classData = (skillsData?.classes || []).find(
        (c) => (c.className || '').toLowerCase() === (set.className || '').toLowerCase()
    );
    const specData = set.spec ? (classData?.specs || []).find((s) => s.specName === set.spec) : null;
    const nameById = new Map();
    for (const s of classData?.skills || []) nameById.set(s.scoreboardId, s.displayName || s.name);
    for (const s of specData?.specSkills || []) nameById.set(s.scoreboardId, s.displayName || s.name);
    const row = ([id, points]) => ({ name: nameById.get(id) || id, points });
    return {
        skills: Object.entries(payload.sk || {})
            .map(row)
            .sort((a, b) => b.points - a.points),
        specSkills: Object.entries(payload.ssk || {})
            .map(row)
            .sort((a, b) => b.points - a.points),
        enhanced: Object.keys(payload.en || {}).map((id) => nameById.get(id) || id),
        cz: Object.keys(payload.cz || {}),
    };
}

function buildDelveDetail(set) {
    const payload = set.payload || {};
    const infusions = SLOTS.filter((slot) => payload.infusions && payload.infusions[slot]).map((slot) => ({
        slot,
        name: payload.infusions[slot],
        level: payload.points && payload.points[slot] !== undefined ? payload.points[slot] : null,
    }));
    return { infusions, revelation: Boolean(payload.revelation) };
}

export default async function Page({ params }) {
    const { id } = await params;
    const set = getPublicSkillSet(id);
    let detail = null;
    if (set) {
        detail = set.kind === 'delve' ? buildDelveDetail(set) : buildSkillDetail(set, await getSkillsData());
    }
    return <SharedSetView set={set} detail={detail} />;
}
