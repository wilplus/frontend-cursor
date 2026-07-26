/* -------------------------------------------------------------------------- */
/*  life/menu — which panel entries this user sees (FE-1, founder 2026-07-26)  */
/*                                                                            */
/*  TWO STAGES, because the Principles tab is the ENTRANCE and the rest are    */
/*  what it opens:                                                            */
/*                                                                            */
/*    stage 1 — Principles only. Any signed-in user the panel exists for, with */
/*      no consent and no setup yet. This is the door: tapping it lands on the */
/*      guide, then consent, then setup. Public behind consent (L-6), not      */
/*      allowlisted, so it is not gated on anything but the kill switch.       */
/*                                                                            */
/*    stage 2 — the other seven, once the user is participating (consented AND */
/*      setup complete). Before that they would open views with nothing in     */
/*      them and no way to put anything there, since every route into the data */
/*      runs through setup.                                                    */
/*                                                                            */
/*  N1 SURVIVES THIS. Entries the user cannot use are still ABSENT, not greyed */
/*  out. What changed is where the list is computed: the server no longer has  */
/*  to enumerate it for the common case, it only has to say whether the panel  */
/*  exists and how far through the gate this user is.                          */
/*                                                                            */
/*  THE SERVER STILL WINS when it wants to. A non-empty `state.menu` replaces  */
/*  this list wholesale, which is the only way an allowlisted entry can ever   */
/*  appear: Prayer is founder-only, the FE cannot know the allowlist, so it is */
/*  never derived here. A payload that wants Prayer sends the whole menu.      */
/*                                                                            */
/*  The kill switch is untouched and upstream of all of it: no state at all    */
/*  (`/v2/life/state` 404s) means no entries, whatever this file says.         */
/* -------------------------------------------------------------------------- */

import { VIEWS } from "./copy";
import { isParticipating, type LifeMenuEntry, type LifeState } from "./types";

interface LifeViewSpec {
  key: string;
  label: string;
  href: string;
  /** False only for Principles, the one view that has to be reachable before
   *  the user has done anything at all. */
  needsSetup: boolean;
}

/** In the order the spec's §6.3 menu lists them. */
export const LIFE_VIEWS: readonly LifeViewSpec[] = [
  {
    key: "principles",
    label: VIEWS.principles.title,
    href: "/panel/principles",
    needsSetup: false,
  },
  { key: "wins", label: VIEWS.wins.title, href: "/panel/wins", needsSetup: true },
  {
    key: "phrases",
    label: VIEWS.phrases.title,
    href: "/panel/phrases",
    needsSetup: true,
  },
  { key: "today", label: VIEWS.today.title, href: "/panel/today", needsSetup: true },
  // The Sunday review. Sits next to Today because it is the same loop at a
  // different cadence, and because that is where the L-2b batch of three lands.
  { key: "week", label: VIEWS.week.title, href: "/panel/week", needsSetup: true },
  { key: "goals", label: VIEWS.goals.title, href: "/panel/goals", needsSetup: true },
  {
    key: "timeline",
    label: VIEWS.timeline.title,
    href: "/panel/timeline",
    needsSetup: true,
  },
  {
    key: "distractions",
    label: VIEWS.distractions.title,
    href: "/panel/distractions",
    needsSetup: true,
  },
  {
    key: "strategy",
    label: VIEWS.strategy.title,
    href: "/panel/strategy",
    needsSetup: true,
  },
];

/**
 * The entries to render, for the hamburger and for the panel's own nav.
 *
 * Both surfaces call this so they can never disagree about what exists.
 */
export function panelMenu(state: LifeState | null): LifeMenuEntry[] {
  if (!state) return [];
  // An explicit server list is authoritative, including when it is shorter
  // than this one. That is how Prayer arrives, and how a surface gets pulled
  // without an FE deploy.
  if (state.menu.length > 0) return state.menu;

  const unlocked = isParticipating(state);
  return LIFE_VIEWS.filter((view) => !view.needsSetup || unlocked).map(
    ({ key, label, href }) => ({ key, label, href })
  );
}
