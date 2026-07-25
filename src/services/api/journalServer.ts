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

/** Published posts for the index. Soft-fails to []. */
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

/** One published post. null = missing, draft, or unreachable → the route 404s. */
export async function fetchJournalPost(
  slug: string
): Promise<JournalPost | null> {
  const backend = getBackendUrl();
  if (!backend) return null;
  let res: Response;
  try {
    res = await fetch(
      `${backend}/v2/journal/posts/${encodeURIComponent(slug)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: REVALIDATE_SEC },
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return mapJournalPost(body);
}
