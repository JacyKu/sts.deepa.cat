import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import {
    getBuild,
    getBuildRevision,
    mergeReferencedCustomItems,
    referencedCustomItemExtras,
} from '../../../lib/sts-builds';
import { getBuildItemHashes, getBuildTokenVersion } from '../utils/builder/buildUrlCodec';
import { getDiscordUser } from '../../../lib/session';
import { getItemData, getItemDataVersion, getSkillsData, getSkillsVersion, getCzVersion } from '../utils/itemsData';
import { getLinkPreviewTitle, getLinkPreviewDescription } from '../utils/buildPreview';
import { stripSeahorseShortcode } from '../utils/buildEmoji';
import { sanitizeBuildTokenForDisplay } from '../utils/builder/buildTokenGuard';
import { BuilderDataView } from './builderDataView';
import BootstrapStyles from './bootstrapStyles';
import { stsBaseForHost } from '../utils/base';

export const dynamic = 'force-dynamic';

const keywords = 'Monumenta, Minecraft, MMORPG, Items, Builder';

// Shared metadata + page for /b/<id> and /b/v<version>/<id>. The version
// segment is informational (the token carries its own version byte); we just
// check it looks like "v<digits>" and prefer the canonical form when the
// stored token disagrees. A ?v=<revision> older than the current revision
// renders that stored revision instead.
export async function buildLinkMetadata(id, revision = null) {
    const row = getBuild(id);
    if (!row) {
        return { title: 'Monumenta Builder', description: 'Make and share Monumenta builds.' };
    }

    const currentRevision = Number(row.revision) || 1;
    const requested = Number(revision);
    const snapshot =
        Number.isInteger(requested) && requested > 0 && requested !== currentRevision
            ? getBuildRevision(row.id, requested)
            : null;
    const shown = snapshot
        ? { ...row, token: snapshot.token, parsedState: snapshot.parsedState, name: snapshot.name }
        : row;

    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    const title =
        stripSeahorseShortcode(shown.name) ||
        getLinkPreviewTitle(shown.token, itemData, null, skillsData) ||
        'Monumenta Builder';
    const description = getLinkPreviewDescription(shown.token, itemData, skillsData, shown.parsedState?.infusions);
    // The DB-backed image carries the delve infusions, which the token alone can't.
    // The &v cache-buster is the row's revision: it bumps on every real change
    // (edit, publicise, anonymity), so Discord fetches a fresh image instead of
    // serving its cached embed (e.g. the author bar). Older revisions render
    // their own stored state.
    const imageUrl = '/api/v2/og?id=' + row.id + '&v=' + (snapshot ? requested : currentRevision);

    return {
        // Pinned to the configured public origin: never derive it from the
        // request Host (a forged Host would spoof the embed/metadata URLs).
        metadataBase: new URL(process.env.STS_PUBLIC_BASE_URL || 'https://sts.deepa.cat'),
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

export async function BuildLinkPageView(id, revision = null) {
    const row = getBuild(id);

    const headersList = await headers();
    const base = stsBaseForHost(headersList.get('host') || '');

    if (!row) {
        redirect(base + '/builder');
    }

    // Opening an older ?v= renders that stored revision. Ownership, visibility
    // and publicise state stay those of the live row; only the build content
    // (token/state/name/notes) comes from the snapshot.
    const currentRevision = Number(row.revision) || 1;
    const requested = Number(revision);
    const snapshot =
        Number.isInteger(requested) && requested > 0 && requested !== currentRevision
            ? getBuildRevision(row.id, requested)
            : null;
    const shownRow = snapshot
        ? {
              ...row,
              token: snapshot.token,
              parsedState: snapshot.parsedState,
              name: snapshot.name,
              notes: snapshot.notes,
          }
        : row;
    const tokenVersion = getBuildTokenVersion(row.token);
    const latestHref = base + '/b/' + (tokenVersion ? `v${tokenVersion}/${row.id}` : row.id) + '?v=' + currentRevision;

    const hashes = getBuildItemHashes(shownRow.token);
    // All of these are independent; fetch them together instead of awaiting
    // the session and item data before starting the rest.
    const [user, baseItemData, skillsData, itemsVersion, skillsVersion, czVersion] = await Promise.all([
        getDiscordUser(),
        getItemData(),
        getSkillsData(),
        getItemDataVersion(),
        getSkillsVersion(),
        getCzVersion(),
    ]);
    const mergedItemData = mergeReferencedCustomItems(baseItemData, user ? user.id : null, hashes);
    // Rows saved before token validation existed can carry junk (unknown
    // charms crash the builder, invalid classes/skills/names pollute it), so
    // the builder only ever sees the sanitized token.
    const displayToken = sanitizeBuildTokenForDisplay(shownRow.token, mergedItemData, skillsData);
    // The item database itself is fetched client-side; only the custom items
    // the build references ride along (usually none).
    const extraItems = referencedCustomItemExtras(baseItemData, user ? user.id : null, hashes);
    // The build opens in place; saves update the DB row, they don't rewrite URLs.
    const isOwner = Boolean(user && row.user_id && user.id === row.user_id);
    // Anonymous rows are editable + publicisable by whoever holds their
    // creator cookie (the browser that created them), even after logging in.
    const cookieStore = await cookies();
    const creatorToken = cookieStore.get(`sts-build-owner-${id}`)?.value || null;
    const isCreator = Boolean(user && !row.user_id && creatorToken);
    return (
        <>
            <BootstrapStyles />
            <BuilderDataView
                build={displayToken}
                savedState={shownRow.parsedState}
                savedName={shownRow.name}
                notes={shownRow.notes}
                // An old revision is a view/restore target: notes and the
                // publicise toggle belong to the live row, so leave them alone
                // while that snapshot is open.
                canEditNotes={snapshot ? false : isOwner || isCreator}
                buildId={row.id}
                revision={snapshot ? requested : currentRevision}
                revisionNotice={snapshot ? { requested, current: currentRevision, href: latestHref } : null}
                canPublicise={snapshot ? false : isOwner || isCreator}
                isPublic={row.is_public === 1}
                isAnonymous={row.anonymous === 1}
                itemsVersion={itemsVersion}
                skillsVersion={skillsVersion}
                czVersion={czVersion}
                extraItems={extraItems}
            />
        </>
    );
}
