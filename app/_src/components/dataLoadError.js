'use client';

import React from 'react';

// Shared error state for the client-side data views: the big data files are
// fetched after the shell renders, so a network failure needs a visible retry
// instead of a page stuck on its skeleton. Styled inline so it needs neither
// Bootstrap (now builder-only) nor a CSS module chunk.
export default function DataLoadError({ message }) {
    return (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ marginBottom: 8 }}>Could not load the item data{message ? ` (${message})` : ''}.</p>
            <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                    padding: '4px 12px',
                    fontSize: '0.875rem',
                    background: 'transparent',
                    color: 'var(--text-1)',
                    border: '1px solid var(--control-border)',
                    borderRadius: 2,
                    cursor: 'pointer',
                }}
            >
                Retry
            </button>
        </div>
    );
}
