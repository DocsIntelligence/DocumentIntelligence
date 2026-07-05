//@ts-check

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},

  // Transpile workspace libs so Next.js compiles them from source
  transpilePackages: [
    '@org/dto',
    '@org/utils',
    '@org/api-client',
    '@org/ui',
    '@org/hooks',
    '@org/store',
    '@org/transliteration',
  ],

  // Dev server port — avoids conflict with API (5230) and React app (5200)
  devIndicators: false,

  async rewrites() {
    // Proxy /api/* to the NestJS backend in development
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5230/api';
    const baseUrl = apiUrl.replace(/\/api$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${baseUrl}/api/:path*`,
      },
    ];
  },
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);
