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
                    // The full Content-Security-Policy (with a per-request script
                    // nonce) is set in proxy.js so it can vary per request.
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
