// Pre-render a freshly saved build's embed card so Discord's first crawl finds
// it in the OG route's in-memory cache instead of paying for the render. The
// save response never waits for it: a warm-up failure (or a slow render) must
// not affect saving.
//
// The OG handler is imported directly instead of fetching the public URL: no
// extra round trip through nginx/Cloudflare, and the card lands in the same
// Node process cache the crawler reads.
import { GET as renderOgImage } from '../app/api/v2/og/route';

export function warmEmbedImage(id, version) {
    if (!id || !version) return;
    try {
        Promise.resolve(
            renderOgImage(
                new Request(
                    `http://sts-internal/api/v2/og?id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`
                )
            )
        ).catch(() => {});
    } catch (error) {
        // Ignore: the embed just renders on demand like before.
    }
}
