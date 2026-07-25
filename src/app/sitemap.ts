import type { MetadataRoute } from "next";
import { fetchJournalPosts } from "@/services/api/journalServer";

const SITE_URL = "https://www.willpowerlab.com";

/**
 * Sitemap of the public, crawlable pages. Authenticated app routes
 * (dashboard, recordings, admin) are intentionally omitted — they are also
 * disallowed in robots.ts.
 *
 * Journal posts are appended dynamically: a blog that isn't in the sitemap
 * can't do its one job. The fetch soft-fails to [], so a backend outage
 * degrades to the static routes rather than breaking the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/chat", priority: 0.9 },
    { path: "/about", priority: 0.8 },
    { path: "/journal", priority: 0.8 },
    { path: "/science", priority: 0.7 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map(
    ({ path, priority }) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly",
      priority,
    })
  );

  const postEntries: MetadataRoute.Sitemap = (await fetchJournalPosts()).map(
    (p) => ({
      url: `${SITE_URL}/journal/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    })
  );

  return [...staticEntries, ...postEntries];
}
