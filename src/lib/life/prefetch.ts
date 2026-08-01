/* -------------------------------------------------------------------------- */
/*  What each panel view reads, and when to start reading it                   */
/*                                                                            */
/*  `panelCache` makes the SECOND visit to a view instant. This decides when   */
/*  the FIRST one is too, and there are two moments worth starting a read:     */
/*                                                                            */
/*    · ON OPEN — every view's read fires in parallel the moment the panel is  */
/*      open and the user is participating, behind whichever view is on        */
/*      screen. First open pays one round of reads, once; every pill after     */
/*      that is instant, with no hover required. This is the founder's         */
/*      "rendered all at once", done as DATA rather than as nine mounted       */
/*      components — the routing, the URLs and the back button all survive.    */
/*                                                                            */
/*    · ON INTENT — a pill starts its own read on hover or touch-start. It     */
/*      still earns its keep after the warm-up: a view whose warm read failed, */
/*      or one revisited long after a write dropped the cache, is warmed again */
/*      by the hand already moving towards it.                                */
/*                                                                            */
/*  GATED ON PARTICIPATION, which is the detail that stops this being waste.   */
/*  Before setup is finished most of these reads 404, so warming on open would */
/*  fire eight requests to collect eight errors, at exactly the moment the     */
/*  user is busy doing the one thing that matters. (Design taken from the      */
/*  parallel implementation in #218, closed as superseded; the gate was the    */
/*  best idea in it.)                                                          */
/*                                                                            */
/*  ONE REGISTRY, PINNED TO THE MENU BOTH WAYS. Each entry carries the view's  */
/*  menu key AND the cache key the view actually reads under, because the two  */
/*  failures are different and both are silent:                                */
/*    · a view in the menu with no entry here stays slow forever;              */
/*    · an entry whose cache key does not match the view's warms a slot        */
/*      nobody reads, which looks identical to doing nothing at all.           */
/*  `prefetch.test.ts` pins both. Neither can rot quietly.                     */
/* -------------------------------------------------------------------------- */

import { prefetchPanelResource } from "./panelCache";
import {
  fetchDay,
  fetchGoals,
  fetchItems,
  fetchPrinciples,
  fetchStrategy,
  fetchTimeline,
  fetchWeek,
} from "@/services/api/life";

interface WarmableView {
  /** The `LIFE_VIEWS` key, so the menu can be held against this list. */
  view: string;
  href: string;
  /** The key the view passes to `usePanelResource`. Must match exactly. */
  cacheKey: string;
  load: () => Promise<unknown>;
}

const WARMABLE: readonly WarmableView[] = [
  { view: "principles", href: "/panel/principles", cacheKey: "principles", load: fetchPrinciples },
  { view: "wins", href: "/panel/wins", cacheKey: "items:win", load: () => fetchItems("win") },
  { view: "phrases", href: "/panel/phrases", cacheKey: "items:phrase", load: () => fetchItems("phrase") },
  { view: "today", href: "/panel/today", cacheKey: "day", load: fetchDay },
  { view: "week", href: "/panel/week", cacheKey: "week", load: fetchWeek },
  { view: "goals", href: "/panel/goals", cacheKey: "goals", load: fetchGoals },
  { view: "timeline", href: "/panel/timeline", cacheKey: "timeline", load: fetchTimeline },
  { view: "distractions", href: "/panel/distractions", cacheKey: "items:distraction", load: () => fetchItems("distraction") },
  { view: "strategy", href: "/panel/strategy", cacheKey: "strategy", load: fetchStrategy },
];

/** Menu keys with deliberately no loader, and the reason. The test reads this,
 *  so an exemption has to be written down rather than assumed. */
export const NOT_WARMED: Readonly<Record<string, string>> = {
  // Its own subdomain and service worker scope (spec §3.4). Nothing to read
  // here, and a cross-origin warm-up would be a request to another app.
  prayer: "external",
  // Not a list and not a pill: the export, the hard delete and the reminders,
  // behind the settings control. Warming a screen reached deliberately once in
  // a while buys nothing and costs a read on every panel open.
  data: "chrome, not a view",
};

/** For the tests that hold this registry against the menu and against the
 *  views' own keys. */
export const WARMABLE_VIEWS: ReadonlyArray<{
  view: string;
  href: string;
  cacheKey: string;
}> = WARMABLE.map(({ view, href, cacheKey }) => ({ view, href, cacheKey }));

/** Start the read behind `href`, if there is one. Safe on every pointer event:
 *  a key already warm or already in flight is dropped on the floor, so
 *  hovering a pill ten times makes at most one request. */
export function warmPanelView(href: string): void {
  const entry = WARMABLE.find((v) => v.href === href);
  if (entry) prefetchPanelResource(entry.cacheKey, entry.load);
}

/**
 * Start every view's read at once.
 *
 * Parallel rather than sequential, and non-blocking rather than gated: nothing
 * on screen waits for any of it. A single blocking "load everything first"
 * would hold the whole panel hostage to its slowest view, turning nine
 * fast-ish reads into one guaranteed-slow one — which is the version of this
 * idea worth NOT building.
 *
 * A view that mounts mid-warm-up joins the read already in flight rather than
 * issuing a twin; `panelCache` dedupes by key.
 */
export function warmAllPanelViews(): void {
  for (const { cacheKey, load } of WARMABLE) {
    prefetchPanelResource(cacheKey, load);
  }
}
