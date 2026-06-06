import type { MetadataRoute } from "next";

const SITE_URL = "https://www.willpowerlab.com";

/**
 * Static sitemap of the public, crawlable pages. Authenticated app
 * routes (dashboard, recordings, admin) are intentionally omitted — they
 * are also disallowed in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/chat", priority: 0.9 },
    { path: "/about", priority: 0.8 },
    { path: "/science", priority: 0.7 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
