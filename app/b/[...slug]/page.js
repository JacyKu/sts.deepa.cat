import { redirect } from 'next/navigation';
import { buildLinkMetadata, BuildLinkPageView } from '../../_src/components/buildLinkPage';
import { getBuildTokenVersion } from '../../_src/utils/builder/buildUrlCodec';
import { getBuild, getBuildRevision } from '../../../lib/sts-builds';
import { stsBaseForHost } from '../../_src/utils/base';
import { headers } from 'next/headers';

// Short links: /b/<id> (legacy) and /b/v<version>/<id>. The token itself
// carries the real version byte; the URL segment just states what the link
// was minted with.
export const dynamic = 'force-dynamic';

function parseSlug(slug) {
    if (!slug || slug.length === 0) return null;
    const [first, second] = slug;
    // Versioned form: /b/v8/<id>
    if (/^v\d+$/.test(first) && second) {
        return { version: first, id: second };
    }
    // Legacy form: /b/<id>
    if (slug.length === 1) {
        return { version: null, id: first };
    }
    return null;
}

// ?v=<revision> for a stored revision, or null when it is missing/not a
// revision number (older links used raw timestamps as the cache-buster).
function parseRevision(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null) return null;
    return /^\d+$/.test(String(raw)) ? Number(raw) : null;
}

export async function generateMetadata({ params, searchParams }) {
    const p = await params;
    const sp = (await searchParams) || {};
    const parsed = parseSlug(p.slug);
    if (!parsed) {
        return { title: 'Monumenta Builder' };
    }
    return buildLinkMetadata(parsed.id, parseRevision(sp.v));
}

export default async function BuildLinkPage({ params, searchParams }) {
    const p = await params;
    const sp = (await searchParams) || {};
    const parsed = parseSlug(p.slug);

    const headersList = await headers();
    const base = stsBaseForHost(headersList.get('host') || '');

    if (!parsed) {
        redirect(base + '/builder');
    }

    // Short links are canonicalised (legacy /b/<id> -> /b/v<version>/<id>,
    // or the reverse for legacy tokens) and always carry a revision as
    // ?v=<revision>. Discord caches embeds per URL, so the link only changes
    // when the build is actually updated (the revision bumps) instead of
    // serving a stale embed. A ?v= pointing at a stored older revision opens
    // that revision; missing/unknown revisions fall back to the latest one.
    const row = getBuild(parsed.id);
    if (row) {
        const tokenVersion = getBuildTokenVersion(row.token);
        // Use the stored id (row.id): lookups are case-insensitive, so a link
        // with the wrong casing must canonicalise to the true id before any
        // write operations (saves, publicise, ...) use it.
        const canonical = tokenVersion ? `${base}/b/v${tokenVersion}/${row.id}` : `${base}/b/${row.id}`;
        const versionOk = parsed.version === (tokenVersion ? `v${tokenVersion}` : null);
        const currentRevision = Number(row.revision) || 1;
        const requestedRevision = parseRevision(sp.v);
        if (!versionOk || row.id !== parsed.id) {
            redirect(canonical + '?v=' + currentRevision);
        }
        if (requestedRevision === null || requestedRevision > currentRevision) {
            redirect(canonical + '?v=' + currentRevision);
        }
        if (requestedRevision !== currentRevision && !getBuildRevision(row.id, requestedRevision)) {
            redirect(canonical + '?v=' + currentRevision);
        }
        return BuildLinkPageView(
            row.id,
            requestedRevision === currentRevision ? null : requestedRevision
        );
    }

    return BuildLinkPageView(parsed.id);
}
