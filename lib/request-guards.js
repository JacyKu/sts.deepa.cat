// Request-body guards shared by the JSON API routes. The reverse proxy allows
// large uploads (profile pictures arrive as data URLs), so each route caps
// what it is willing to parse: the data limits inside the handlers then bound
// what actually gets stored.

export const MAX_JSON_BODY_BYTES = 256 * 1024;

export function bodyTooLarge(request, maxBytes = MAX_JSON_BODY_BYTES) {
    const header = request.headers.get('content-length');
    if (!header) return false;
    const length = Number(header);
    return Number.isFinite(length) && length > maxBytes;
}

export function tooLargeJson() {
    return Response.json({ error: 'payload too large' }, { status: 413 });
}
