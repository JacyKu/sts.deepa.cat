'use client';

import React from 'react';

// Shared error state for the client-side data views: the big data files are
// fetched after the shell renders, so a network failure needs a visible retry
// instead of a page stuck on its skeleton.
export default function DataLoadError({ message }) {
    return (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p className="mb-2">Could not load the item data{message ? ` (${message})` : ''}.</p>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => window.location.reload()}>
                Retry
            </button>
        </div>
    );
}
