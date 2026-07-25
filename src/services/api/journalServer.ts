import { getBackendUrl } from "@/app/api/getAuth";
import {
  mapJournalPost,
  mapJournalSummary,
  type JournalPost,
  type JournalPostSummary,
} from "./journal";

/* -------------------------------------------------------------------------- */
/*  journalServer — public Journal reads, server-side only                     */
/*                                                                            */
/*  SERVER ONLY: `getBackendUrl` comes from a "server-only" module, so this     */
/*  file can never be imported from a client component (that's why the types +  */
/*  pure helpers live in the isomorphic `journal.ts` next door).                */
/*                                                                            */
/*  These endpoints are PUBLIC by contract — no token, no cookie. They must NOT */
/*  go through the authed BFF (proxyJson/proxyMultipart 401 without a Supabase   */
/*  session), which would make the whole Journal 401 for logged-out visitors.    */
/*                                                                            */
/*  Everything soft-fails (list → [], post → null) so a backend that is down —   */
/*  or simply not shipped yet — renders an empty Journal / a 404 instead of      */
/*  crashing the route.                                                         */
/* -------------------------------------------------------------------------- */

/** ISR window, matched to the pages' `export const revalidate`. */
const REVALIDATE_SEC = 300;

/** Published posts for the index. Soft-fails to [].
 *
 *  Deliberately ASYMMETRIC with fetchJournalPost, which throws: this one runs
 *  at BUILD time (prerendering /journal, generateStaticParams, the sitemap)
 *  where the backend may legitimately not exist yet, and throwing there would
 *  fail the build. The failure modes also differ in cost — an empty index is a
 *  200 the next revalidation repairs, whereas a cached 404 on a real post tells
 *  crawlers the page was removed. */
export async function fetchJournalPosts(): Promise<JournalPostSummary[]> {
  const backend = getBackendUrl();
  if (!backend) return [];
  let res: Response;
  try {
    res = await fetch(`${backend}/v2/journal/posts?limit=100`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SEC },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const rows = Array.isArray(body?.posts) ? (body.posts as unknown[]) : [];
  return rows
    .map(mapJournalSummary)
    .filter((p): p is JournalPostSummary => p !== null);
}

/** One post. `null` means GENUINELY GONE (404/410, which is also how a draft
 *  reads) and the route turns that into a 404.
 *
 *  Everything else THROWS, on purpose. The caller renders notFound() for null,
 *  and this route is ISR: a 404 produced during a backend blip would be written
 *  into the route cache and replayed for the whole revalidate window, so a live
 *  published post would hard-404 for visitors AND crawlers long after the
 *  backend recovered (a background revalidation could even overwrite a healthy
 *  cached page with it). Throwing instead makes Next keep serving the last good
 *  render and retry in seconds, and a cold miss yields a 5xx, which crawlers
 *  retry rather than treating as removal. */
export async function fetchJournalPost(
  slug: string
): Promise<JournalPost | null> {
  const backend = getBackendUrl();
  if (!backend) return null;
  const res = await fetch(
    `${backend}/v2/journal/posts/${encodeURIComponent(slug)}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SEC },
    }
  );
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    throw new Error(`Journal post fetch failed (HTTP ${res.status}).`);
  }
  const body = await res.json().catch(() => null);
  return mapJournalPost(body);
}
