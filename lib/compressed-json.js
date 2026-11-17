// JSON responses for the large data endpoints.
//
// These used to be compressed here, but Next 16.4.5's response handling can
// strip or reapply Content-Encoding. That left the browser with compressed
// bytes and no way to decode them (Unexpected token ... is not valid JSON), so
// the routes now return plain JSON and let Next/Cloudflare negotiate encoding.

const wrappers = new WeakMap();

// Routes hand the big data objects to the client wrapped ("{ items: ... }"),
// which would defeat object-identity caching. This returns the same wrapper
// for the same data object so the serialised copy survives across requests.
export function stableWrapper(key, data) {
    let entry = wrappers.get(data);
    if (!entry || entry.key !== key) {
        entry = { key, value: { [key]: data } };
        wrappers.set(data, entry);
    }
    return entry.value;
}

/**
 * JSON response.
 *
 * @param {unknown} data body to serialise (objects are cached per instance)
 * @param {object} options
 * @param {object} [options.headers] extra headers (Cache-Control etc.)
 */
export function compressedJsonResponse(data, { headers = {} } = {}) {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...headers,
        },
    });
}
