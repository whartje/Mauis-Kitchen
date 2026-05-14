import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Bundle the cat PNG into the icon serverless functions so fs.readFileSync
  // works on Vercel without needing to fetch from a CDN URL.
  outputFileTracingIncludes: {
    "/icon": ["./public/maui-cat.png.png"],
    "/apple-icon": ["./public/maui-cat.png.png"],
  },
};

export default nextConfig;
