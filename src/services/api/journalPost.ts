import { mapJournalPost, type JournalPost } from "./journal";

/* -------------------------------------------------------------------------- */
/*  journalPost — one published Journal post, read from the browser            */
/*                                                                            */
/*  The Feedback walk's "More about self-modeling theory" opens the signed     */
/*  self-modeling post inside the overlay (build plan D-FW-18; decisions log  */
/*  N53.4 JP1 A, published by the founder as D-OP-2). The post is read        */
/*  through the public same-origin route (/api/v2/journal/posts/:slug) and    */
/*  drawn by the Journal's one renderer (BodyBlocks); its words are the post's */
/*  own, never copied into the app.                                           */
/*                                                                            */
/*  Anything but a published post is null (a draft, a 404, a network blip):   */
/*  the walk hides the link rather than open a broken screen.                 */
/* -------------------------------------------------------------------------- */

/** The stable address of the signed self-modeling post (JP1 A; the slug the
 *  founder published it under, Navigation Panel HO-10 to HO-10c). */
export const SELF_MODELING_POST_SLUG = "why-we-ask-you-to-judge-honestly";

/** The published post at `slug`, or null. Never throws. */
export async function fetchPublishedJournalPost(slug: string): Promise<JournalPost | null> {
  try {
    const res = await fetch(`/api/v2/journal/posts/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const post = mapJournalPost(await res.json().catch(() => null));
    return post && post.title.trim() && post.body.trim() ? post : null;
  } catch {
    return null;
  }
}
