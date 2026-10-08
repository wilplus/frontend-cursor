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
/* -------------------------------------------------------------------------- */

import {
  fetchIdealTextEnrichment,
  mergeIdealTextEnrichment,
  settleIdealTextEnrichment,
  type Addition,
  type CoachMessage,
  type DecisionHistoryEntry,
  type DocumentSuggestion,
  type IdealPiece,
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
