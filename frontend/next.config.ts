import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mark Node.js-only modules so they are not bundled into the client
  serverExternalPackages: ['dns', 'crypto', 'nodemailer', 'cheerio'],
};

export default nextConfig;
