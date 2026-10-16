// Pre-render a build's embed card so Discord's first crawl finds it in the OG
// route's in-memory cache instead of paying for the render. Used in two
// places: right after a save (the common case) and after a data update, which
// changes the OG cache key for every build (the key includes the item/skills
// data versions) and would otherwise turn each next crawl into a full render.
//
// The OG handler is imported directly instead of fetching the public URL: no
// extra round trip through nginx/Cloudflare, and the card lands in the same
// Node process cache the crawler reads.
import { after } from 'next/server';
import { GET as renderOgImage } from '../app/api/v2/og/route';
import { listPublicBuilds } from './sts-builds';

// Render one card and resolve once it is in the cache (respondCached buffers
// the PNG before returning, so awaiting the response is enough).
export function renderEmbedCard(id, version) {
    return renderOgImage(
        new Request(`http://sts-internal/api/v2/og?id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`)
    );
}

// Save-path warm-up. Scheduled with after() so the render runs once the
// response has been sent (a fire-and-forget promise can be cut short when the
// request context closes). The save response never waits for it: a warm-up
// failure (or a slow render) must not affect saving.
export function warmEmbedImage(id, version) {
    if (!id || !version) return;
    try {
        after(() => renderEmbedCard(id, version).catch(() => {}));
    } catch (error) {
        // Ignore: the embed just renders on demand like before. (after() throws
        // if there is no active request, e.g. when called from a script.)
    }
}

// How many cards a data-update re-warm covers, and the gap between them. The
// renders are CPU-heavy (satori + sharp), so they run one at a time with a
// short pause to stay out of the way of live traffic. The OG card cache holds
// 150 entries, so this fills only part of it and the rest stays for crawls.
const WARM_LIMIT = 24;
const WARM_GAP_MS = 150;

// Single-flight: an item update and a class update can finish close together,
// and running two sweeps at once would just render the same cards twice.
let warming = null;

// Re-render the most recently shared public builds. Called after an item or
// class data update, which invalidates every card's cache key. Best effort
// throughout: a build that fails (deleted, unrenderable) just goes back to
// rendering on demand. Returns the number of cards that rendered.
export function warmRecentEmbeds({ limit = WARM_LIMIT } = {}) {
    if (warming) return warming;
    warming = (async () => {
        let warmed = 0;
        try {
            const { builds } = listPublicBuilds({ sort: 'new', limit });
            for (const row of builds) {
                try {
                    // The version only busts client/CDN caches for build cards -
                    // the OG route reads the revision from the DB row itself -
                    // so a fallback of 1 is fine when the listing has no column.
                    const response = await renderEmbedCard(row.id, row.revision || 1);
                    if (response && response.ok) warmed += 1;
                } catch (error) {
                    // One bad card must not stop the sweep.
                }
                await new Promise((resolve) => setTimeout(resolve, WARM_GAP_MS));
            }
        } catch (error) {
            // Listing failed (e.g. no DB yet): nothing to warm.
        } finally {
            warming = null;
        }
        return warmed;
    })();
    return warming;
}
