import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browsers from guessing MIME types (stops certain XSS vectors)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Deny framing — protects against clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Stop sending Referer header to third-party sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Limit browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Force HTTPS for 1 year (includeSubDomains)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

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
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
