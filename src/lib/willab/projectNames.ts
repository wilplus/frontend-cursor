/* -------------------------------------------------------------------------- */
/*  PROJECT NAMES — one name, one project (founder 2026-08-15).                */
/*                                                                            */
/*  WHY THIS EXISTS. ProjectPicker's doctrine is "one title == one project ==  */
/*  one arc == one ideal text", and since the arc-identity fix the backend     */
/*  MEANS it: a deckless take with no uploaded PDF is matched to its project   */
/*  by the NORMALIZED TOPIC. So the title is not a label any more, it is the   */
/*  identity — and two projects sharing one were never really two projects.    */
/*                                                                            */
/*  What the founder actually hit: a new recording called "Book" landed among  */
/*  three takes called "Testtttt" and the two became indistinguishable after   */
/*  the fact. That collision was machine-authored (a shared deck hash) and is  */
/*  fixed. This module closes the HUMAN-authored version of the same thing:    */
/*  typing a name that is already taken.                                      */
/*                                                                            */
/*  ⚠️ THE NORMALIZER MUST MATCH THE BACKEND EXACTLY. `_continue_topic_arc`    */
/*  does `" ".join(topic.strip().lower().split())` — trim, lowercase, collapse */
/*  internal whitespace — and decides from that whether a take joins an        */
/*  existing arc. If this file were laxer, the UI would call "Book " free      */
/*  while the server silently filed it under "book"; a guard that disagrees    */
/*  with the rule it guards is worse than no guard, because it is TRUSTED.     */
/*  Change one side and you must change the other.                            */
/*                                                                            */
/*  Pure + unit-tested: no fetch, no React, no DOM.                           */
/* -------------------------------------------------------------------------- */

/** The backend's identity form of a project name. Mirror of
 *  `" ".join(topic.strip().lower().split())` in routes/v2/arcs.py.
 *
 *  `split()` with no argument splits on ANY whitespace run — tabs and newlines
 *  included, not just spaces — so this uses /\s+/ rather than " " to match. */
export function normalizeProjectName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Two names that the backend would treat as one project. */
export function isSameProjectName(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeProjectName(a);
  return na.length > 0 && na === normalizeProjectName(b);
}

export interface NamedProject {
  arcId: string;
  topic: string;
}

/** The existing project a proposed name would collide with, or null.
 *
 *  Returns the PROJECT, not a boolean, so the caller can name it back to the
 *  user and offer to continue it — "that name is taken" is an obstacle,
 *  "you already have this, open it" is an answer.
 *
 *  An empty / whitespace-only name collides with nothing: it is not yet a
 *  name, and the step's own required-field rule owns that case. */
export function findProjectNameConflict(
  proposed: string | null | undefined,
  existing: readonly NamedProject[] | null | undefined
): NamedProject | null {
  const want = normalizeProjectName(proposed);
  if (!want) return null;
  for (const p of existing ?? []) {
    if (p && normalizeProjectName(p.topic) === want) return p;
  }
  return null;
}

/** A free name near the one they typed: "Book" → "Book 2" → "Book 3" …
 *
 *  Offered rather than imposed. The counter starts at 2 because the name they
 *  typed is conceptually the first, and it skips any suffix already in use so
 *  the suggestion is never itself a collision. Bounded so a pathological
 *  library cannot spin here. */
export function suggestFreeProjectName(
  proposed: string | null | undefined,
  existing: readonly NamedProject[] | null | undefined,
  limit = 50
): string {
  const base = (proposed ?? "").trim();
  if (!base) return "";
  if (!findProjectNameConflict(base, existing)) return base;
  for (let n = 2; n < limit + 2; n += 1) {
    const candidate = `${base} ${n}`;
    if (!findProjectNameConflict(candidate, existing)) return candidate;
  }
  return "";
}
