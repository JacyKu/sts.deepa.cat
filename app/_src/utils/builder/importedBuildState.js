'use client';

// Saved builds keep their delve infusions / Revelation / basic infusions in
// the DB, which the URL token cannot carry. A build imported from the other
// STS site (sts.deepa.cat <-> dev.deepa.cat) has no local row, so the import
// bar stashes that state here (keyed by the token) and the builder reads it
// back while restoring the URL build.
const IMPORTED_STATE_KEY = 'sts.importedBuildState.v1:';

export function stashImportedBuildState(token, state) {
    if (!token || !state) return;
    try {
        window.sessionStorage.setItem(IMPORTED_STATE_KEY + token, JSON.stringify(state));
    } catch (e) {}
}

export function readImportedBuildState(token) {
    if (!token) return null;
    try {
        const raw = window.sessionStorage.getItem(IMPORTED_STATE_KEY + token);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}
