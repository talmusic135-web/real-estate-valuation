/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["playwright-core", "@prisma/client"],
};
export default nextConfig;
