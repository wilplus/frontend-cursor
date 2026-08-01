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
import {
  hasConsented,
  isParticipating,
  type LifeMenuEntry,
  type LifeState,
} from "./types";

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
 * Every panel entry this user has: the PANEL's own nav renders all of them.
 *
 * Still the single source of what exists — `hamburgerMenu` is derived from it
 * below rather than listing views again, so the two surfaces can differ in
 * what they SHOW without ever disagreeing about what there IS.
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

/* -------------------------------------------------------------------------- */
/*  Resolving a server-sent key (founder 2026-08-01)                          */
/*                                                                            */
/*  /v2/life/state sends `menu` as a list of KEYS — ["principles", "wins", …] */
/*  — and this side required objects carrying {key, href}. Every entry was    */
/*  therefore discarded and `state.menu` was always empty, which meant the    */
/*  derived list below is what has always rendered. Two things were broken by */
/*  that and neither was visible: the server could not pull or add a surface  */
/*  without an FE deploy, and PRAYER COULD NEVER APPEAR for the allowlisted   */
/*  user the server enumerates it for.                                        */
/*                                                                            */
/*  So a key resolves HERE, against this file, and the label stays in copy.ts */
/*  where copy lives. The alternative — the backend sending labels and hrefs  */
/*  — would put user-facing wording in two repos and let them drift.          */
/*                                                                            */
/*  Prayer is resolvable but NOT derivable: it is in this table and not in    */
/*  LIFE_VIEWS, so it appears when the server names it and never otherwise.   */
/*  That is the allowlist working as intended, rather than this side guessing.*/
/* -------------------------------------------------------------------------- */
export const RESOLVABLE_VIEWS: ReadonlyMap<string, LifeMenuEntry> = new Map(
  [
    ...LIFE_VIEWS.map(({ key, label, href }) => [key, { key, label, href }]),
    [
      "prayer",
      {
        key: "prayer",
        label: VIEWS.prayer.title,
        // Its own subdomain, its own service worker scope, its own PWA
        // install — so it leaves the app rather than routing inside it.
        href: "https://pompeiana.willpowerlab.com",
        external: true,
      },
    ],
    ["data", { key: "data", label: VIEWS.data.title, href: "/panel/data" }],
  ] as [string, LifeMenuEntry][]
);

/** One server-sent entry → something renderable, or null.
 *
 *  Accepts BOTH shapes on purpose: a bare key (what the backend sends today)
 *  and a full object (what a future payload might send to override a label or
 *  point a key somewhere new). An object still wins over the table, so the
 *  server keeps the last word; a key it does not recognise is dropped rather
 *  than rendered as a dead entry. */
export function resolveMenuEntry(raw: unknown): LifeMenuEntry | null {
  if (typeof raw === "string") return RESOLVABLE_VIEWS.get(raw) ?? null;
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const key = typeof m.key === "string" ? m.key : null;
  if (!key) return null;
  const known = RESOLVABLE_VIEWS.get(key);
  const href = typeof m.href === "string" ? m.href : known?.href;
  if (!href) return null;
  return {
    key,
    label:
      typeof m.label === "string" && m.label ? m.label : known?.label ?? key,
    href,
    external:
      typeof m.external === "boolean" ? m.external : known?.external ?? false,
  };
}

/** The panel views that live INSIDE the Principles tab — everything the tab's
 *  own nav already puts one tap away. Principles itself is not here: it is the
 *  door, and the door belongs in the hamburger. */
const PANEL_SUBVIEW_KEYS: ReadonlySet<string> = new Set(
  LIFE_VIEWS.filter((view) => view.key !== "principles").map((v) => v.key)
);

/**
 * The entries the APP-WIDE hamburger renders (founder 2026-08-01).
 *
 * Principles only. The other eight are reached from inside the Principles tab,
 * whose pill row still lists every one of them, so putting them in the global
 * menu too made one set of destinations appear in two places and turned the
 * app menu into a table of contents for a single feature.
 *
 * FILTERED, NOT RE-LISTED. It takes `panelMenu`'s answer and removes the
 * sub-views, so a view added to LIFE_VIEWS later is automatically inside the
 * tab rather than in the hamburger, and a key this file does not know — a
 * server-sent entry such as Prayer, which is its own app rather than part of
 * the panel — is KEPT. The hamburger drops what belongs to Principles; it does
 * not become a hardcoded list of one.
 */
export function hamburgerMenu(state: LifeState | null): LifeMenuEntry[] {
  return panelMenu(state).filter((entry) => !PANEL_SUBVIEW_KEYS.has(entry.key));
}

/* -------------------------------------------------------------------------- */
/*  panelChrome — what the bar above the panel offers (founder 2026-08-01)     */
/*                                                                            */
/*  Pure and here rather than inline in PanelShell, because the bug it exists  */
/*  to prevent was invisible from inside that component: setup stripped the    */
/*  WHOLE bar, and the gear linking to /panel/data went with it. The Principles*/
/*  tab IS the setup form until setup finishes, and the pre-setup menu holds   */
/*  Principles alone, so that one line removed every route to the export and   */
/*  the hard delete — while the consent screen kept promising both were two    */
/*  clicks away. A user half-way through setup could not erase it.             */
/*                                                                            */
/*  Three independent answers, not one flag, because they have three different */
/*  reasons: the views are withheld to keep one thing on the screen, the data  */
/*  control is offered to anyone who has written anything, and the exit is     */
/*  withheld only where the wizard already draws its own.                      */
/* -------------------------------------------------------------------------- */

export interface PanelChrome {
  /** The pill row of panel views. */
  showViews: boolean;
  /** The way to the export and the hard delete. */
  showData: boolean;
  /** The panel's own close control. */
  showExit: boolean;
}

/** `onboarding` is "this screen is the setup form" — true on /panel/setup and
 *  on /panel/principles until setup finishes, which is the mount most people
 *  actually meet. */
export function panelChrome(
  state: LifeState | null,
  onboarding: boolean
): PanelChrome {
  return {
    showViews: !onboarding,
    // Consent, not participation, and NOT gated on onboarding: consenting and
    // saving answers is already writing something, so the way to erase it has
    // to exist from that moment.
    showData: hasConsented(state),
    showExit: !onboarding,
  };
}
