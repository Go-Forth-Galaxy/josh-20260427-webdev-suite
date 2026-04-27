import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the galaxyai reverse-proxy host to load /_next dev resources (HMR,
  // chunks) so React hydrates and click handlers actually fire in the browser.
  allowedDevOrigins: [
    "port-3013.ai.go-forth.com",
    "*.ai.go-forth.com",
  ],
};

export default nextConfig;
