/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["*.daytonaproxy01.net"],
  // Keep the diagnostic build separate from the running `next dev` output.
  distDir: process.env.PILOT_BUILD_CHECK === "1" ? ".next-diagnostic" : ".next",
};

module.exports = nextConfig;
