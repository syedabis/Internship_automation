/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/certificate',
  serverExternalPackages: ['@napi-rs/canvas'],
};

export default nextConfig;
