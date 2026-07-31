/* -------------------------------------------------------------------------- */
/*  Which kind the document dock is pointed at (founder 2026-07-31)            */
/*                                                                            */
/*  The dock sits under every view and hands the drafter the kind that view    */
/*  HOLDS, so a document opened from Phrases is read for phrases and one       */
/*  opened from Principles for principles. That is the whole of the mapping:   */
/*  one route prefix, one item kind.                                          */
/*                                                                            */
/*  IT IS A HINT, NOT A FILTER. The FE does not decide what a document can     */
/*  yield and never drops rows for coming back the "wrong" kind: a strategy    */
/*  document opened from Phrases that also holds three goals should offer the  */
/*  goals. Hiding them would be the frontend overruling the read.              */
/*                                                                            */
/*  Views that hold no single kind (Today, Week, Strategy, the data screen)    */
/*  map to null, which sends no hint at all. That is exactly the request every */
/*  one of these made before the dock existed, so a null is not a degraded     */
/*  case; it is the original one.                                             */
/*                                                                            */
/*  TIMELINE'S `event` IS A NO-OP TODAY, and deliberately so on their side     */
/*  (BE 2026-07-31): the backend accepts it and runs only the base pass,       */
/*  because Timeline already renders dated goals as markers and an `event`     */
/*  pass would draft a second, separately tickable copy of every one of them.  */
/*  Two tickable rows for one written line is worse than an honest empty       */
/*  answer. The hint is still sent: it is correct about what the view holds,   */
/*  it costs nothing, and the day that decision is revisited this file needs   */
/*  no edit.                                                                   */
/* -------------------------------------------------------------------------- */

import type { LifeItemKind } from "./types";

/** Route prefix → the kind that view holds. Order matters only in that each
 *  prefix must be checked against the whole path, so `/panel/principles/:id`
 *  answers the same as the index it was opened from. */
const KIND_BY_PREFIX: ReadonlyArray<[string, LifeItemKind]> = [
  ["/panel/principles", "principle"],
  ["/panel/phrases", "phrase"],
  ["/panel/wins", "win"],
  ["/panel/goals", "goal"],
  ["/panel/distractions", "distraction"],
  ["/panel/timeline", "event"],
];

export function uploadKindForPath(pathname: string | null): LifeItemKind | null {
  if (!pathname) return null;
  for (const [prefix, kind] of KIND_BY_PREFIX) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return kind;
  }
  return null;
}
