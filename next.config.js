/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'jsonwebtoken'] },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
};
