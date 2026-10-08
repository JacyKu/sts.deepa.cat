'use client';

import React from 'react';

// Community-chosen names for recorded update runs (closed name polls), as
// { '<runAt>': 'Name' }. Fetched once per page visit; the changes pages use it
// to label their run cards with the winning poll option.
export function useRunNames(kind) {
    const [names, setNames] = React.useState(null);
    React.useEffect(() => {
        let cancelled = false;
        fetch('/api/v2/update-names')
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!cancelled && data && data.names) setNames(data.names[kind] || {});
            })
            .catch(() => {
                // Names are decoration; the pages work without them.
            });
        return () => {
            cancelled = true;
        };
    }, [kind]);
    return names || {};
}
