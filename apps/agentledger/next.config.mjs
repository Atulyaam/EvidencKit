/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@evidencekit/core",
    "@evidencekit/evidence-server",
    "@evidencekit/agent-sdk",
    "@evidencekit/db",
    "@evidencekit/ui"
  ],
  reactStrictMode: true
};

export default nextConfig;
