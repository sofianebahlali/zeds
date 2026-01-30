/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["socket.io"],
  },
  // Enable standalone output for deployment
  output: "standalone",
};

module.exports = nextConfig;
