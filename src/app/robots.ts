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
      // /cms is the Journal CMS. It moved off /admin, so it needs its own
      // entry or the move would silently make an internal tool crawlable.
      disallow: [
        "/admin",
        "/cms",
        "/api",
        "/dashboard",
        "/profile",
        "/recordings",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
