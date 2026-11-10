/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chatpilot/ui', '@chatpilot/contracts', '@chatpilot/config'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
