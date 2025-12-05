import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Skip TypeScript errors during build - React 19 has breaking type changes
  // that affect @radix-ui/react-slot and @tanstack/react-query
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
