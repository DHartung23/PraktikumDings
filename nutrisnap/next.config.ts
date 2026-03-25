import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // some next versions put it under experimental
  },
  // the log output suggested this:
  allowedDevOrigins: ['192.168.1.19', 'localhost:3000'],
};

export default nextConfig;
