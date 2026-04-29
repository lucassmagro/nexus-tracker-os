import type { NextConfig } from "next";

const nextConfig: any = {
  experimental: {
    turbopack: {
      root: ".",
    },
  },
};

export default nextConfig;
