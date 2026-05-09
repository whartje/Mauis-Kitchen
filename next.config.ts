import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Bundle the cat PNG into the serverless function for the icon routes.
  // Without this, Vercel serves public/ files from the CDN and fs.readFileSync
  // cannot reach them from inside a serverless function at runtime.
  outputFileTracingIncludes: {
    "/**": ["./public/maui-cat.png.png"],
  },
};

export default nextConfig;
