/* -------------------------------------------------------------------------- */
/*  How the Ideal Text page loads (founder 2026-10-08, waiting-time fixes).    */
/*                                                                            */
/*  Pure helpers and the enrichment sequence, moved out of IdealTextOverlay   */
/*  (grandfathered at the complexity ratchet; it may only shrink). Timing     */
/*  and loading only: nothing here decides what a screen draws or says.       */
/*                                                                            */
/*  F1  the prompt lane (coach message, journey, key moments, entitlement,    */
/*      learning) is applied the moment it answers, not when the slow         */
/*      `document_layers` lane does; the slow lane likewise on its own.       */
/*  F2  a refetch of the document already on screen keeps the feedback it    */
/*      showed (bars, coach note, key moments, additions) until the new       */
/*      enrichment replaces each piece. Only rows the Manager already         */
/*      approved and the page already showed are kept (L2); a new arc, a      */
/*      first load or a new Take starts clean.                                */
/*  P1  a first open paints the Lounge's handover (up to 30 s old) and, past  */
/*      the trusted 3 s, reads the core fresh behind it.                      */
/* -------------------------------------------------------------------------- */

import {
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
  mergeIdealTextEnrichment,
  settleIdealTextEnrichment,
  type Addition,
  type CoachMessage,
  type DecisionHistoryEntry,
  type DocumentSuggestion,
  type IdealPiece,
  type IdealText,
  type IdealTextEnrichmentResult,
  type IdealTextResult,
  type KeyPoint,
} from "@/services/api/idealText";
import {
  PROMPT_LANE,
  SLOW_LANE,
  feedbackStillComing,
} from "@/lib/willab/enrichmentSettle";
import type { Part } from "@/lib/willab/documentParts";
import type { LearningExposureHandle } from "@/services/api/learningExposures";
import type {
  ConfidentMomentOwnerEdit,
  ConfidentMomentSummary,
} from "@/services/api/confidentMomentBundles";

export type SingleIdealText = Extract<IdealTextResult, { kind: "single" }>;
type ReadyEnrichment = Extract<IdealTextEnrichmentResult, { kind: "ready" }>;

/** The living-document state the Ideal Text page holds (SD). */
export interface IdealTextSd {
  status: "unverified" | "verified";
  version: number | null;
  momentsUnlocked: boolean;
  explanationsAvailable: boolean;
  title: string | null;
  latestTakeSessionId: string | null;
  pieces: IdealPiece[] | null;
  suggestions: DocumentSuggestion[] | null;
  /** Slice 2 — the post-lock style lane + the decided-proposal history. */
  styleChanges: DocumentSuggestion[] | null;
  /** Phase 2: V3 could not make this Take's Feedback. */
  feedbackFailed: boolean;
  decisionHistory: DecisionHistoryEntry[] | null;
  saved: boolean | null;
  keyPoints: KeyPoint[] | null;
  /** The arc's deck PDF (slide-per-paragraph read). Safe-ahead: null until
   *  the BE echoes presentation_ref; useArcDeckRef then falls back. */
  presentationRef: string | null;
  /** Slide titles by index — the deck's title slot. */
  slideTitles: string[] | null;
  /** The document's stored part ids (SPEC §3.1, Step 0). null → none
   *  stored, and the arranger mints locally so a part has an id from its
   *  first render either way. */
  parts: Part[] | null;
  /** MATERIAL RECOVERY — words said on a slide the script has no block for. */
  additions: Addition[];
  /** T1 · 1.2 — the served text IS the student's edit → no star layer. */
  userEdited: boolean;
  /** The BE's gate on a new official take. null (absent) never gates. */
  canRecordTake: boolean | null;
  takeCount: number | null;
  journeyNextStepsSeen: boolean | null;
  coachMessage: CoachMessage | null;
  learningExposures: LearningExposureHandle[];
  confidentMomentSummary: ConfidentMomentSummary | null;
  confidentMomentOwnerEdit: ConfidentMomentOwnerEdit | null;
}

/** The page state one served result describes. */
export function sdFromResult(r: SingleIdealText): IdealTextSd {
  return {
    status: r.status,
    version: r.version,
    momentsUnlocked: r.momentsUnlocked,
    explanationsAvailable: r.explanationsAvailable,
    title: r.title,
    latestTakeSessionId: r.latestTakeSessionId,
    pieces: r.pieces,
    suggestions: r.suggestions,
    styleChanges: r.styleChanges,
    feedbackFailed: r.feedbackFailed === true,
    decisionHistory: r.decisionHistory,
    saved: r.saved,
    keyPoints: r.keyPoints,
    presentationRef: r.presentationRef,
    slideTitles: r.slideTitles,
    parts: r.parts,
    additions: r.additions,
    userEdited: r.userEdited,
    canRecordTake: r.canRecordTake,
    takeCount: r.takeCount,
    journeyNextStepsSeen: r.journeyNextStepsSeen,
    coachMessage: r.coachMessage,
    learningExposures: r.learningExposures,
    confidentMomentSummary: r.confidentMomentSummary ?? null,
    confidentMomentOwnerEdit: r.confidentMomentOwnerEdit ?? null,
  };
}

type SectionStatuses = Readonly<Record<string, string>> | undefined;

const answered = (sections: SectionStatuses, name: string): boolean =>
  sections?.[name] === "ready";

/** F2 — the page state for `next`, keeping what the page already showed
 *  wherever the section that would replace it has not answered yet.
 *
 *  `prev` is the state ON SCREEN, so a decision recorded on it
 *  (`withSuggestionStatus`, `withStyleApproved`) is what is kept: the item
 *  just decided shows its new status, never as still pending. Nothing new is
 *  ever introduced — every kept row is one the Manager approved and the page
 *  already drew (L2). */
export function carryShownFeedback(
  prev: IdealTextSd | null,
  next: IdealTextSd,
  sections: SectionStatuses,
  carry: boolean,
): IdealTextSd {
  if (!carry || !prev) return next;
  const layers = answered(sections, "document_layers");
  const journey = answered(sections, "journey");
  const history = answered(sections, "history");
  return {
    ...next,
    suggestions: layers ? next.suggestions : prev.suggestions,
    styleChanges: layers ? next.styleChanges : prev.styleChanges,
    keyPoints: layers ? next.keyPoints : prev.keyPoints,
    additions: layers ? next.additions : prev.additions,
    coachMessage: journey ? next.coachMessage : prev.coachMessage,
    decisionHistory: history ? next.decisionHistory : prev.decisionHistory,
  };
}

/** F2 — the same rule for the coach's key moments, which live on the text. */
export function carryKeyMoments(
  prev: IdealText | null,
  next: IdealText,
  sections: SectionStatuses,
  carry: boolean,
): IdealText {
  if (!carry || !prev || answered(sections, "feedback")) return next;
  return { ...next, keyMoments: prev.keyMoments };
}

/** Whether a refetch may keep what is on screen: not a first load of this
 *  arc, and the same Take — a new Take's feedback is about other words, so
 *  it starts clean. */
export function mayCarry(
  firstLoad: boolean,
  shownTake: string | null | undefined,
  nextTake: string | null,
): boolean {
  return !firstLoad && shownTake !== undefined && shownTake === nextTake;
}

/** Merge one lane's answer, keeping the section statuses of earlier lanes
 *  (the merge itself records only the answer it was given). */
export function mergeLane(
  current: SingleIdealText,
  lane: ReadyEnrichment,
): SingleIdealText {
  const merged = mergeIdealTextEnrichment(current, lane);
  if (merged === current) return current;
  return {
    ...merged,
    enrichmentSections: {
      ...(current.enrichmentSections ?? {}),
      ...(merged.enrichmentSections ?? {}),
    },
  };
}

/** The two lanes' answers as one, as the settle needs them. */
export function combineLanes(
  prompt: IdealTextEnrichmentResult,
  slow: IdealTextEnrichmentResult,
): IdealTextEnrichmentResult {
  if (prompt.kind === "ready" && slow.kind === "ready") {
    return { ...prompt, sections: { ...prompt.sections, ...slow.sections } };
  }
  return prompt.kind === "ready" ? prompt : slow;
}

export interface EnrichmentHooks {
  /** False once the page has moved on (a newer read, a closed overlay). */
  isCurrent: () => boolean;
  apply: (merged: SingleIdealText) => void;
  setPending: (pending: boolean) => void;
  refetch: () => void;
  fetchLane?: typeof fetchIdealTextEnrichment;
  settle?: typeof settleIdealTextEnrichment;
}

/** Ask both lanes at once and apply each the moment it answers (F1), then
 *  settle the mark sections and close the reserved slot as before.
 *
 *  TWO LANES, ASKED AT ONCE (founder 2026-09-22): the marks get the long
 *  server budget in their own request while everything the page draws around
 *  them keeps the tight one. Neither waits for the other any more: the coach
 *  message, journey, key moments, entitlement and learning used to sit
 *  behind `document_layers` for up to ~4.5 s. The merge is per section, so
 *  applying the answers in whatever order they land is the same document. */
export async function loadIdealTextEnrichment(
  arcId: string,
  core: SingleIdealText,
  hooks: EnrichmentHooks,
): Promise<void> {
  const snapshot = core.documentSnapshotId;
  if (!snapshot) return;
  const fetchLane = hooks.fetchLane ?? fetchIdealTextEnrichment;
  const settle = hooks.settle ?? settleIdealTextEnrichment;
  let merged = core;
  const applyOnLanding = (lane: IdealTextEnrichmentResult) => {
    if (lane.kind !== "ready" || !hooks.isCurrent()) return lane;
    merged = mergeLane(merged, lane);
    hooks.apply(merged);
    return lane;
  };
  const [prompt, slow] = await Promise.all([
    fetchLane(arcId, snapshot, PROMPT_LANE).then(applyOnLanding),
    fetchLane(arcId, snapshot, SLOW_LANE).then(applyOnLanding),
  ]);
  if (!hooks.isCurrent()) return;
  const enrichment = combineLanes(prompt, slow);
  if (enrichment.kind !== "ready") {
    // It answered without anything to add: stop reserving room for marks.
    hooks.setPending(false);
    // Never mix revisions: pull the new core, keeping this one visible.
    if (enrichment.kind === "stale") hooks.refetch();
    return;
  }
  // Judge the slot from the first answers; a retryable non-mark section
  // (the F2 `learning` receipt) never holds the bookmarks back.
  hooks.setPending(feedbackStillComing(enrichment.sections));
  const settled = await settle(arcId, snapshot, enrichment);
  if (!hooks.isCurrent()) return;
  if (settled.kind === "ready") {
    merged = mergeLane(merged, settled);
    hooks.apply(merged);
    // The slot closes when the server is done, or the budget is spent
    // (founder 2026-09-20) — read from the sections, not the envelope.
    hooks.setPending(feedbackStillComing(settled.sections));
  } else if (settled.kind === "stale") {
    hooks.refetch();
  }
}

/** P1 — whether a revalidating read describes the document already painted
 *  from the Lounge's handover. Different → the page refetches in place. */
export function sameServedDocument(
  shown: IdealTextResult,
  fresh: IdealTextResult,
): boolean {
  if (fresh.kind !== shown.kind) return false;
  if (fresh.kind !== "single" || shown.kind !== "single") {
    return (
      "ideal" in fresh &&
      "ideal" in shown &&
      fresh.ideal.text === shown.ideal.text
    );
  }
  return (
    fresh.documentSnapshotId === shown.documentSnapshotId &&
    fresh.version === shown.version &&
    fresh.ideal.text === shown.ideal.text &&
    JSON.stringify(fresh.confidentMomentSummary ?? null) ===
      JSON.stringify(shown.confidentMomentSummary ?? null) &&
    JSON.stringify(fresh.confidentMomentOwnerEdit ?? null) ===
      JSON.stringify(shown.confidentMomentOwnerEdit ?? null)
  );
}

/** A refetch's read, in the shape of the first open's. */
export async function readFreshCore(
  arcId: string,
): Promise<{ result: IdealTextResult; revalidate: boolean }> {
  return { result: await fetchIdealTextCore(arcId), revalidate: false };
}

/** P1 — after painting a handover older than the trusted window, read the
 *  core fresh behind it; when the document moved, refetch in place (the
 *  F2 rule keeps the page from blanking). The enrichment of the painted
 *  snapshot keeps running meanwhile: a snapshot is immutable. */
export function revalidateHandoff(
  arcId: string,
  shown: IdealTextResult,
  hooks: { isCurrent: () => boolean; refetch: () => void },
  read: (arcId: string) => Promise<IdealTextResult> = fetchIdealTextCore,
): Promise<void> {
  return read(arcId).then((fresh) => {
    if (!hooks.isCurrent()) return;
    const usable =
      fresh.kind === "single" || fresh.kind === "ready" || fresh.kind === "instant";
    if (usable && !sameServedDocument(shown, fresh)) hooks.refetch();
  });
}
