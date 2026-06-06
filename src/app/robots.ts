import type { MetadataRoute } from "next";

const SITE_URL = "https://www.willpowerlab.com";

/**
 * Robots policy for WillpowerLab. Public marketing/legal pages are
 * crawlable; the app surface (admin, API, and authenticated areas) is
 * disallowed so it stays out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/dashboard", "/profile", "/recordings"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
