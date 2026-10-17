/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chatpilot/ui', '@chatpilot/contracts', '@chatpilot/config'],
};

module.exports = nextConfig;
