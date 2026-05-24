import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  experimental: {
    // Tree-shake large barrel-export packages — only bundles icons/components actually used
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  images: {
    remotePatterns: [
      {
        // Supabase Storage — allows Next/Image to serve WebP-optimised, CDN-cached receipts
        protocol: "https",
        hostname: "sunckfanyfmcsmncmqla.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
