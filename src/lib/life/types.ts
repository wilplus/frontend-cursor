/* -------------------------------------------------------------------------- */
/*  life — shared types and constants for the Life Panel (/panel/*)            */
/*                                                                            */
/*  ISOMORPHIC ON PURPOSE: every panel view is a client component, so this     */
/*  module must stay importable from the browser. Nothing here imports a       */
/*  "server-only" module; the network reads live in `services/api/life.ts`.    */
/*                                                                            */
/*  Fences this module encodes (spec §1.5, FE prompt §0):                      */
/*    N4 — there is no score type here, and none may be added. No alignment    */
/*         percentage, no streak, no completion ratio, no "consistency". The   */
/*         only numbers this surface renders are counts and dates.            */
/*    N1 — the menu is a server payload. Entries the user cannot reach are     */
/*         ABSENT from it, so they are absent from the DOM. There is no        */
/*         `disabled` field on a menu entry, deliberately.                     */
/*    N5 — anything the model produced carries `status: "proposed"` until the  */
/*         user approves it. `LifeProposal` has no default-accepted state.     */
/* -------------------------------------------------------------------------- */

/* ------------------------------- the gate --------------------------------- */

/** `GET /v2/life/state` — the whole gate in one payload.
 *
 *  A 404 from that endpoint means the feature is off (LIFE_PANEL_ENABLED=0) or
 *  this user is not on the allowlist for anything. The FE treats 404 as "the
 *  panel does not exist" and renders nothing, anywhere. Never a "coming soon". */
export interface LifeState {
  /** Consent (L-6). No life data may be written before `acceptedVersion`
   *  equals `requiredVersion`. */
  consent: { requiredVersion: string; acceptedVersion: string | null };
  /** Setup is a hard gate (spec §6.2): a # typed before completion is stored
   *  but does not run the engine. `resumeStep` is where the form left off. */
  setup: { complete: boolean; resumeStep: string | null };
  /** N1 — render exactly these entries, in this order, and nothing else. */
  menu: LifeMenuEntry[];
  /** Optional server-side override of the composer's tag picker list. Absent →
   *  the FE's own registry (`hashtags.ts`) is used. */
  tags?: LifeTagDescriptor[];
}

export interface LifeMenuEntry {
  key: string;
  label: string;
  href: string;
  /** Prayer links out to pompeiana.willpowerlab.com (spec §3.4). */
  external?: boolean;
}

export interface LifeTagDescriptor {
  /** Canonical tag without the "#". */
  tag: string;
  label: string;
  /** Hidden tags route but never appear in the picker or the guide (`#sin`). */
  hidden?: boolean;
}

/** Has this user passed both gates? Only then does the engine run for them,
 *  and only then does the chat # layer mount at all. */
export function isParticipating(state: LifeState | null): boolean {
  if (!state) return false;
  const { requiredVersion, acceptedVersion } = state.consent;
  return acceptedVersion === requiredVersion && state.setup.complete;
}

export function hasConsented(state: LifeState | null): boolean {
  if (!state) return false;
  return state.consent.acceptedVersion === state.consent.requiredVersion;
}

/** The three jobs of the Principles tab (spec §6.2) — never on one page. */
export type PrinciplesTabView = "first_run" | "setup" | "results";

export function principlesTabView(state: LifeState): PrinciplesTabView {
  if (!hasConsented(state)) return "first_run";
  if (!state.setup.complete) return "setup";
  return "results";
}

/* ---------------------------- the mistake taxonomy ------------------------ */

/** FIXED at six (spec §3.1). Derived from the corpus, not emergent, not
 *  free-text. A case may carry more than one. A seventh only ever arrives as a
 *  proposal the founder approves, never as a silent new key. */
export type LifeMistakeCategory =
  | "hubris"
  | "blind_spots"
  | "wishful_thinking"
  | "too_much_pleasure"
  | "frivolous_decision_making"
  | "perfectionist";

export const LIFE_MISTAKE_CATEGORIES: ReadonlyArray<{
  key: LifeMistakeCategory;
  label: string;
}> = [
  { key: "hubris", label: "Hubris" },
  { key: "blind_spots", label: "Blind spots" },
  { key: "wishful_thinking", label: "Wishful thinking" },
  { key: "too_much_pleasure", label: "Too much pleasure" },
  { key: "frivolous_decision_making", label: "Frivolous decision making" },
  { key: "perfectionist", label: "Perfectionist" },
];

const MISTAKE_KEYS = new Set<string>(
  LIFE_MISTAKE_CATEGORIES.map((c) => c.key)
);

export function isMistakeCategory(v: unknown): v is LifeMistakeCategory {
  return typeof v === "string" && MISTAKE_KEYS.has(v);
}

export function mistakeCategoryLabel(key: string): string {
  return LIFE_MISTAKE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/* --------------------------------- items ---------------------------------- */

export type LifeItemKind =
  | "principle"
  | "win"
  | "phrase"
  | "bet"
  | "goal"
  | "task"
  | "habit"
  | "distraction"
  | "event";

export type LifeHorizon =
  | "now"
  | "month"
  | "quarter"
  | "year"
  | "five_year"
  | "ten_year";

/** The three bets, ranked (spec §3.2). The rank is load-bearing: bet 3 never
 *  outranks bet 2 in a daily plan. */
export type LifeBetKey = "life" | "company" | "dream";

export const LIFE_BETS: ReadonlyArray<{
  key: LifeBetKey;
  rank: 1 | 2 | 3;
  glyph: string;
  label: string;
  /** Canvas band colour on the timeline. Matches the ported renderer's
   *  categoryColor field (spec §3.6). */
  color: string;
}> = [
  { key: "life", rank: 1, glyph: "🟢", label: "The Life", color: "#2f9e44" },
  { key: "company", rank: 2, glyph: "🔵", label: "The Company", color: "#1971c2" },
  { key: "dream", rank: 3, glyph: "🟣", label: "The Dream", color: "#7048e8" },
];

export function betByKey(key: string | null | undefined) {
  return LIFE_BETS.find((b) => b.key === key) ?? null;
}

export interface LifeItem {
  id: string;
  kind: LifeItemKind;
  title: string;
  body: string;
  status: string | null;
  horizon: LifeHorizon | null;
  /** Free text exactly as the user writes it: "[NOW]", "[Aug]", "[Jul '27]",
   *  "2035". THE LABEL IS THE SOURCE OF TRUTH, not `dueAt` (spec §3.2). */
  dueLabel: string | null;
  /** Parsed only where unambiguous; null otherwise. Used for timeline
   *  placement, never for display. */
  dueAt: string | null;
  betKey: LifeBetKey | null;
  parentId: string | null;
  /** Phrases only: the collection tag ("2022-24", "2025", "2026", "wall"). */
  collection: string | null;
  originCaseId: string | null;
  createdAt: string | null;
}

/* --------------------------------- cases ---------------------------------- */

/** One principle, with the case that produced it. The five slots of the Dalio
 *  reflection are: case at hand, category, principles applied, reflections,
 *  the principle itself. */
export interface LifePrinciple {
  id: string;
  /** The ⚜️ one-liner. */
  title: string;
  body: string;
  createdAt: string | null;
  /** L-5 — how many times this principle has been cited. A count and its
   *  contexts, never a rank and never a score (N4). */
  applicationCount: number;
  retired: boolean;
}

export interface LifePrincipleDetail extends LifePrinciple {
  caseAtHand: string;
  categories: LifeMistakeCategory[];
  /** Slot 3 — which existing principles bore on the case, retrieved not typed. */
  principlesApplied: Array<{ id: string; title: string; note: string | null }>;
  /** Slot 4 — written by the user. Never drafted (L-1). */
  reflections: string;
  occurredOn: string | null;
  applications: LifeApplication[];
}

/** L-5 — one logged citation of a principle. */
export interface LifeApplication {
  id: string;
  /** Where it was cited: a case, a comparison flag, or a conflict pair. */
  context: "case" | "comparison" | "conflict" | "lookup";
  summary: string;
  /** Deep link into the panel view that holds the citation, when there is one. */
  href: string | null;
  at: string | null;
}

/* ------------------------------- the day card ----------------------------- */

/** `GET /v2/life/day` — the day, in TWO moments (founder, 2026-07-26).
 *
 *  05:00 writes the morning card: the plan. 23:00 writes the evening summary:
 *  the recap. One `life_days` row, two generation passes, two cards.
 *
 *  BOTH ARE LANDING STATES, NEVER NOTIFICATIONS (N3 / L-4). Generation is
 *  scheduled; delivery is not. Nothing pings at 05:00 and nothing pings at
 *  23:00 either: the card and the summary are simply there when the panel or
 *  the chat is next opened. */
export interface LifeDay {
  date: string;
  morning: LifeDayMorning;
  evening: LifeDayEvening;
}

export interface LifeDayMorning {
  /** When the 05:00 pass ran. Null → not written yet. */
  generatedAt: string | null;
  /** The habit checkboxes that ran this morning. */
  checks: LifeCheck[];
  /** 🎯 THE one thing. The FRAME is fixed; the CONTENT is editable via #edit. */
  oneThing: string;
  /**
   * Which bet the one thing serves.
   *
   * Load-bearing since Bet 3 became eligible for daily tasks: with all three
   * bets in play, an unlabelled card makes the RANK invisible on the surface
   * the rank governs. Bet 3 never outranks Bet 2 in a daily plan (spec §3.2),
   * and the only way to see that being honoured is to name the bet.
   */
  oneThingBet: LifeBetKey | null;
  /** Each block carries its bet, for the same reason. */
  focusBlocks: Array<{
    text: string;
    box: string | null;
    betKey: LifeBetKey | null;
  }>;
  distractionFlagged: string | null;
  bets: Array<{
    key: LifeBetKey;
    rank: number;
    label: string;
    goals: Array<{ id: string; title: string; dueLabel: string | null }>;
  }>;
  habits: LifeCheck[];
}

export interface LifeDayEvening {
  /** When the 23:00 pass ran. NULL UNTIL IT HAS: the summary section renders
   *  its frame and says when it gets written, rather than showing an empty
   *  block or, worse, a count of what is missing. */
  generatedAt: string | null;
  /**
   * The system's recap of the day, one line per item.
   *
   * FACTUAL ONLY — what the one thing was, which habits ran, what got flagged.
   * L-1: the system never drafts reflections, so these lines report and stop.
   * The reflective half of the evening is `answer` below, and that is the
   * user's to write.
   */
  summary: string[];
  habitsRan: boolean;
  oneThingDone: boolean;
  distraction: string;
  /** The question the review ends on, e.g. "am I becoming the man I
   *  described?". Frame, not content: it comes from the payload or falls back
   *  to the copy default. */
  question: string;
  /** The user's answer to it. Written by them, never drafted, and rendered
   *  with no placeholder that would write for them (L-1 / N6). */
  answer: string;
}

export interface LifeCheck {
  id: string;
  label: string;
  done: boolean;
}

/* ------------------------------ the week ---------------------------------- */

/** `GET /v2/life/week` — the Sunday review (spec §3.3).
 *
 *  Where the L-2b budget lands: proposals that did not fit the one-per-day
 *  allowance queue here and arrive as a RANKED BATCH OF THREE. Scarcity is what
 *  keeps "approve" meaningful, so this view must never grow a "show all
 *  queued" affordance, and the batch is the batch.
 *
 *  Also where untagged notes get their read: a note typed with no hashtag
 *  captures and does nothing, and this is the "nothing" being surfaced once a
 *  week rather than pinged about (spec §5). */
export interface LifeWeek {
  /** The week's date, however the backend keys it. */
  weekOf: string;
  /** Habits that failed, and the user's own account of why. */
  habitsFailed: Array<{ id: string; label: string; why: string }>;
  /** Goals that moved, and what happens next. */
  goalsMoved: Array<{ id: string; title: string; nextAction: string }>;
  mainDistraction: string;
  /**
   * ONE environmental change per week.
   *
   * Singular on purpose: Section IV answers every distraction with a design
   * response rather than with willpower, and one change a week is the rate the
   * founder set. Not a list, not a backlog.
   */
  environmentalChange: string;
  /** The becoming sentence. The user's, never drafted (L-1 / N6). */
  becomingSentence: string;
  /** The ranked batch of three (L-2b). Empty is a normal week. */
  proposals: LifeProposal[];
  /** Notes that carried no tag. Captured, never executed. */
  untagged: Array<{ id: string; body: string; createdAt: string | null }>;
}

/* ------------------------------- proposals -------------------------------- */

/** N5 — three card types, one discipline: the model's output is visibly the
 *  model's until the user accepts it. Nothing here has an accepted default. */
export type LifeProposalKind = "strategy" | "conflict" | "retire";

export interface LifeProposalBase {
  id: string;
  kind: LifeProposalKind;
  createdAt: string | null;
  /** L-2b — proposals expire after two weeks rather than accumulating. */
  expiresAt: string | null;
}

/** A strategy change. `reportOnly` is set when it targets Section I (The
 *  Anchor) or the rank of the bets, which are hand-edited only (L-2a) — the
 *  card then has NO approve button at all, not a disabled one. */
export interface LifeStrategyProposal extends LifeProposalBase {
  kind: "strategy";
  /** The line it contradicts, quoted from the document. */
  contradicts: string;
  /** The proposed edit, as a diff. */
  diff: LifeDiffLine[];
  /** L-2 — one of the USER'S OWN principles, displayed as the warrant. A
   *  proposal without a warrant is not renderable and is dropped. */
  warrant: { id: string; title: string };
  section: string | null;
  reportOnly: boolean;
}

export interface LifeDiffLine {
  op: "keep" | "add" | "remove";
  text: string;
}

/** L-3 — two principles that pull opposite ways. Shown side by side, with no
 *  recommendation and no default selection. The system never picks, and the UI
 *  must not pick for it by making one side visually heavier. */
export interface LifeConflictProposal extends LifeProposalBase {
  kind: "conflict";
  left: { id: string; title: string; body: string };
  right: { id: string; title: string; body: string };
  /** What triggered the pair being surfaced. */
  occasion: string | null;
}

/** L-3 — "does this retire #12?". Veto is absolute; on No both stay active and
 *  the question is never asked again. */
export interface LifeRetireProposal extends LifeProposalBase {
  kind: "retire";
  incoming: { id: string; title: string };
  existing: { id: string; title: string; ordinal: number | null };
}

export type LifeProposal =
  | LifeStrategyProposal
  | LifeConflictProposal
  | LifeRetireProposal;

/* -------------------------------- strategy -------------------------------- */

export interface LifeStrategy {
  version: number;
  body: string;
  reviewedOn: string | null;
  createdAt: string | null;
}

/** Re-upload produces a diff the user approves, never a silent overwrite. */
export interface LifeStrategyDiff {
  version: number;
  lines: LifeDiffLine[];
  /** Sections the upload would touch that are hand-edited only (L-2a). Those
   *  hunks are dropped, and named here so the drop is visible. */
  blockedSections: string[];
}

/* -------------------------------- timeline -------------------------------- */

export interface LifeTimelineEvent {
  id: string;
  title: string;
  /** ISO date. Events without one cannot be placed and are filtered out. */
  at: string;
  endAt: string | null;
  betKey: LifeBetKey | null;
  body: string | null;
  /** Goals render as markers, bets as colour bands (spec §3.6). */
  kind: "event" | "goal" | "bet";
  dueLabel: string | null;
}

/** 60 years cannot render at one scale — 240 quarters. The tier switches with
 *  scale (spec §3.6 / FE-8). */
export type LifeTimelineTier = "quarter" | "year" | "decade";

/* ------------------------------- chat cards ------------------------------- */

/** The card a # turn carries back. Rides in the bot message's `metadata`,
 *  exactly like `suggested_action` does, so it survives reload and scroll-back
 *  without a second write path. */
export interface LifeChatCardData {
  /** Which panel view the card links into. */
  view: string;
  title: string;
  lines: string[];
  /** The single wall phrase, the user's own words returned at the moment they
   *  apply. Absent → render NO phrase. Never a placeholder (FE-5). */
  phrase: string | null;
  /** Set when the turn produced something needing approval, so the card can say
   *  so without pretending the thing already landed (N5). */
  awaitingApproval: boolean;
}
