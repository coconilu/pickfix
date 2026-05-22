import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.3.182"],
  devIndicators: false,
};

export default nextConfig;
