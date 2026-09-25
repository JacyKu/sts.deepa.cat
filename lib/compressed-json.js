import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

// The big JSON endpoints (item database, raw items, skills) are several
// megabytes uncompressed, and Next's own compression skips streamed route
// handler bodies - so they are compressed here, before they leave the server.
// Both encodings are built once per data object and kept: the data helpers
// return a cached object until the underlying file changes, so a WeakMap keyed
// by that object invalidates the compressed copies exactly when the data does.
const cache = new WeakMap();

function cacheEntry(data) {
    if (typeof data !== 'object' || data === null) return null;
    let entry = cache.get(data);
    if (!entry) {
        entry = { json: null, gzip: null, br: null };
        cache.set(data, entry);
    }
    return entry;
}

function encode(buffer, encoding) {
    if (encoding === 'br') {
        return brotliCompressSync(buffer, {
            params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
        });
    }
    return gzipSync(buffer, { level: 6 });
}

// Accept-Encoding is a preference list, but a substring check is enough here:
// every browser that sends "br" also accepts gzip, and a client that only
// accepts one of them sends that one alone.
function preferredEncoding(header) {
    if (!header) return null;
    const accepts = String(header).toLowerCase();
    if (accepts.includes('br')) return 'br';
    if (accepts.includes('gzip')) return 'gzip';
    return null;
}

/**
 * JSON response, compressed when the client accepts it.
 *
 * @param {unknown} data body to serialise (objects are cached per instance)
 * @param {object} options
 * @param {Request} [options.request] used to read Accept-Encoding
 * @param {object} [options.headers] extra headers (Cache-Control etc.)
 * @param {number} [options.minimumSize] skip compression below this byte size
 */
export function compressedJsonResponse(data, { request, headers = {}, minimumSize = 1024 } = {}) {
    const encoding = request ? preferredEncoding(request.headers.get('accept-encoding')) : null;
    const entry = cacheEntry(data);

    if (entry && entry.json === null) entry.json = JSON.stringify(data);
    const json = entry ? entry.json : JSON.stringify(data);

    if (!encoding || json.length < minimumSize) {
        return new Response(json, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Vary: 'Accept-Encoding',
                ...headers,
            },
        });
    }

    if (entry && entry[encoding] === null) entry[encoding] = encode(Buffer.from(json), encoding);

    return new Response(entry ? entry[encoding] : encode(Buffer.from(json), encoding), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Encoding': encoding,
            Vary: 'Accept-Encoding',
            ...headers,
        },
    });
}
