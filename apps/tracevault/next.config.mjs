/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@evidencekit/core",
    "@evidencekit/evidence-server",
    "@evidencekit/adapters",
    "@evidencekit/db",
    "@evidencekit/ui"
  ],
  reactStrictMode: true
};

export default nextConfig;
