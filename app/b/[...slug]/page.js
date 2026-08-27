import { redirect } from 'next/navigation';
import { buildLinkMetadata, BuildLinkPageView } from '../../_src/components/buildLinkPage';
import { getBuildTokenVersion } from '../../_src/utils/builder/buildUrlCodec';
import { getBuild } from '../../../lib/sts-builds';
import { stsBaseForHost } from '../../_src/utils/base';
import { headers } from 'next/headers';

// Short links: /b/<id> (legacy) and /b/v<version>/<id>. The token itself
// carries the real version byte; the URL segment just states what the link
// was minted with.
export const dynamic = 'force-dynamic';

function parseSlug(slug) {
    if (!slug || slug.length === 0) return null;
    const [first, second] = slug;
    // Versioned form: /b/v6/<id>
    if (/^v\d+$/.test(first) && second) {
        return { version: first, id: second };
    }
    // Legacy form: /b/<id>
    if (slug.length === 1) {
        return { version: null, id: first };
    }
    return null;
}

export async function generateMetadata({ params }) {
    const p = await params;
    const parsed = parseSlug(p.slug);
    if (!parsed) {
        return { title: 'Monumenta Builder' };
    }
    return buildLinkMetadata(parsed.id);
}

export default async function BuildLinkPage({ params, searchParams }) {
    const p = await params;
    const sp = await searchParams;
    const parsed = parseSlug(p.slug);

    const headersList = await headers();
    const base = stsBaseForHost(headersList.get('host') || '');

    if (!parsed) {
        redirect(base + '/builder');
    }

    // Short links are canonicalised (legacy /b/<id> -> /b/v<version>/<id>,
    // or the reverse for legacy tokens) and always carry a ?v cache-buster
    // built from the row's timestamps. Discord caches embeds per URL, so a
    // shared link without a timestamp keeps serving the stale embed even
    // after the build is edited; the ?v makes the URL change with the build.
    const row = getBuild(parsed.id);
    if (row) {
        const tokenVersion = getBuildTokenVersion(row.token);
        const canonical = tokenVersion ? `${base}/b/v${tokenVersion}/${parsed.id}` : `${base}/b/${parsed.id}`;
        const versionOk = parsed.version === (tokenVersion ? `v${tokenVersion}` : null);
        const cacheBuster = encodeURIComponent(
            (row.updated_at || row.created_at || '') + '|' + (row.publicized_at || '')
        );
        if (!versionOk || !sp.v) {
            redirect(canonical + '?v=' + cacheBuster);
        }
    }

    return BuildLinkPageView(parsed.id);
}
