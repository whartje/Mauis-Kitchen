import { MetadataRoute } from "next";

const BASE_URL = "https://www.mauis-kitchen.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/sign-in", "/sign-up", "/privacy"],
        // Keep all authenticated dashboard routes private from crawlers
        disallow: [
          "/dashboard",
          "/recipes",
          "/discover",
          "/meal-plan",
          "/pantry",
          "/grocery-list",
          "/settings",
          "/pricing",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
