/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    serverExternalPackages: ['better-sqlite3', 'sharp'],
    transpilePackages: ['@deepa/shared'],
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    // frame-ancestors covers browsers that ignore X-Frame-Options;
                    // the rest of a full CSP is deliberately left out until the
                    // inline scripts/styles can be nonce'd safely.
                    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
