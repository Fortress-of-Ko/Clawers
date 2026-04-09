const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://dapi.kakao.com https://t1.daumcdn.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob: https://i.ytimg.com",
              "media-src 'self' blob: https: data:",
              "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com https://nominatim.openstreetmap.org https://overpass-api.de https://overpass.kumi.systems https://overpass.openstreetmap.ru",
              "worker-src 'self' blob:",
              "frame-src 'self' https://www.openstreetmap.org https://openstreetmap.org",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
