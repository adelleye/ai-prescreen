/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:4000';
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shared/core', '@ui/kit'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
      {
        source: '/assessments/:path*',
        destination: `${API_ORIGIN}/assessments/:path*`,
      },
      {
        source: '/magic/:path*',
        destination: `${API_ORIGIN}/magic/:path*`,
      },
      {
        source: '/report/:path*',
        destination: `${API_ORIGIN}/report/:path*`,
      },
      {
        source: '/dev/:path*',
        destination: `${API_ORIGIN}/dev/:path*`,
      },
    ];
  },
};

export default nextConfig;
