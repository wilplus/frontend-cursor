/* -------------------------------------------------------------------------- */
/*  Warming a view before the tap lands                                        */
/*                                                                            */
/*  `panelCache` makes the SECOND visit to a view instant. This makes the      */
/*  first one feel that way too: the pills start their view's read on hover    */
/*  (desktop) or on touch-start (mobile), so by the time the route paints the  */
/*  data is usually already in the cache.                                      */
/*                                                                            */
/*  Touch-start is the mobile half and it is not a rounding error: it fires    */
/*  roughly 100ms before the click on a tap, and the panel is a phone surface  */
/*  first. On a slow connection that is a head start, not a fix.               */
/*                                                                            */
/*  Next's `<Link>` already prefetches the ROUTE — the JavaScript for the      */
/*  page. It has never prefetched the DATA, because the data is read by a      */
/*  client effect after mount. That gap is exactly the spinner.                */
/*                                                                            */
/*  A HREF WITH NO ENTRY HERE IS A NO-OP, deliberately. Prayer is external,    */
/*  the data screen is not a list, and a view the server invents tomorrow      */
/*  must not throw on hover. Warming is an optimisation and behaves like one:  */
/*  it never changes what renders, only when.                                  */
/* -------------------------------------------------------------------------- */

import { prefetchPanelResource } from "./panelCache";
import {
  fetchDay,
  fetchGoals,
  fetchItems,
  fetchPrinciples,
  fetchTimeline,
  fetchWeek,
} from "@/services/api/life";

/** Route → the cache key and the read behind it. Keys MUST match the ones the
 *  views pass to `usePanelResource`, or a warm read lands in a slot nothing
 *  looks in — the failure would be silent and would only show as "it is still
 *  slow", so `prefetch.test.ts` pins the pairs. */
const WARMABLE: ReadonlyArray<[string, string, () => Promise<unknown>]> = [
  ["/panel/principles", "principles", fetchPrinciples],
  ["/panel/wins", "items:win", () => fetchItems("win")],
  ["/panel/phrases", "items:phrase", () => fetchItems("phrase")],
  ["/panel/distractions", "items:distraction", () => fetchItems("distraction")],
  ["/panel/goals", "goals", fetchGoals],
  ["/panel/today", "day", fetchDay],
  ["/panel/week", "week", fetchWeek],
  ["/panel/timeline", "timeline", fetchTimeline],
];

/** The keys this module can warm, for the test that holds them against the
 *  views' own keys. */
export const WARMABLE_KEYS: ReadonlyArray<[string, string]> = WARMABLE.map(
  ([href, key]) => [href, key]
);

/** Start the read behind `href`, if there is one. Safe to call repeatedly and
 *  on every pointer event: the cache drops a warm key and an in-flight one on
 *  the floor, so hovering a pill ten times makes at most one request. */
export function warmPanelView(href: string): void {
  const entry = WARMABLE.find(([route]) => route === href);
  if (!entry) return;
  prefetchPanelResource(entry[1], entry[2]);
}
