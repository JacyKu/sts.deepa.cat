// Pre-render a freshly saved build's embed card so Discord's first crawl finds
// it in the OG route's in-memory cache instead of paying for the render. The
// save response never waits for it: a warm-up failure (or a slow render) must
// not affect saving.
//
// The OG handler is imported directly instead of fetching the public URL: no
// extra round trip through nginx/Cloudflare, and the card lands in the same
// Node process cache the crawler reads.
//
// Scheduled with after() so the render runs once the response has been sent
// (a fire-and-forget promise can be cut short when the request context closes).
import { after } from 'next/server';
import { GET as renderOgImage } from '../app/api/v2/og/route';

export function warmEmbedImage(id, version) {
    if (!id || !version) return;
    try {
        after(() =>
            renderOgImage(
                new Request(
                    `http://sts-internal/api/v2/og?id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`
                )
            ).catch(() => {})
        );
    } catch (error) {
        // Ignore: the embed just renders on demand like before. (after() throws
        // if there is no active request, e.g. when called from a script.)
    }
}
