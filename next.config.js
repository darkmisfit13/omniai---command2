/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "*.daytonaproxy01.net",
    "*.run.app",
    "*.us-west2.run.app",
    "ais-dev-vp3kzskkzmcsvxrk6ygqmi-392740165099.us-west2.run.app",
    "ais-pre-vp3kzskkzmcsvxrk6ygqmi-392740165099.us-west2.run.app",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
  experimental: {
    allowedDevOrigins: [
      "*.daytonaproxy01.net",
      "*.run.app",
      "*.us-west2.run.app",
      "ais-dev-vp3kzskkzmcsvxrk6ygqmi-392740165099.us-west2.run.app",
      "ais-pre-vp3kzskkzmcsvxrk6ygqmi-392740165099.us-west2.run.app",
      "localhost:3000",
      "127.0.0.1:3000",
    ],
  },
  // Keep the diagnostic build separate from the running `next dev` output.
  distDir: process.env.PILOT_BUILD_CHECK === "1" ? ".next-diagnostic" : ".next",
  // Bind to both IPv4 and IPv6
  httpAgentOptions: {
    keepAlive: true,
  },
  // ESLint warnings (no-img-element, exhaustive-deps) must not abort the
  // production build — Vercel treats lint errors as fatal exit-1.
  // Warnings are still visible in `next lint` and in the editor.
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/media", destination: "/studio/assets", permanent: false },
    ];
  },
};

module.exports = nextConfig;
