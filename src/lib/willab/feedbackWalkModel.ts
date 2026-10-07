/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK, AS MOUNTED (build plan D-FW-14; founder lock            */
/*  2026-10-06; N53.3 NX1 A, N63 Q-B3 A).                                      */
/*                                                                            */
/*  Pure: from the Take's feedback items, as the page holds them, the walk's   */
/*  plan (walkPlan.ts) cut to the screens this phase draws, and each moment's */
/*  paragraph, player and praise words so a screen can be drawn from its      */
/*  step alone.                                                               */
/*                                                                            */
/*  THIS PHASE draws the coach's note, the praise and the helper words, the   */
/*  clearer version (D-FW-15), then the end card. The other screens of the    */
/*  plan are left out here, not drawn half-built:                             */
/*    TODO(D-FW-16) practising and the machine's check (after "Accept and     */
/*      practise" the walk goes on to the plan's next screen until then)      */
/*    TODO(D-FW-17) the exercise video                                        */
/*    TODO(D-FW-18) "Judgement time!" and the judgements                      */
/*    TODO(D-FW-20) sharing                                                   */
/*                                                                            */
/*  No number, read or score is an input or an output (AC-9). The words are   */
/*  the caller's, already signed: this file adds none.                        */
/* -------------------------------------------------------------------------- */

import { clearerPieces, type ClearerPieces } from "./clearerPieces";
import {
  buildWalkPlan,
  stepForMoment,
  walkMomentGroups,
  walkMoments,
  type WalkFeedbackItem,
  type WalkStep,
  type WalkStepKey,
} from "./walkPlan";

/** The speaker's own voice for a moment. */
export type WalkClip = {
  src: string;
  startOffsetMs: number | null;
  durationMs: number | null;
};

/** One feedback item as the walk needs it. `R` is the served item a
 *  clearer version is decided on (the page's DocumentSuggestion); the walk
 *  only hands it back. */
export type FeedbackWalkItem<R = unknown> = WalkFeedbackItem & {
  /** The paragraph it sits in. */
  partId: string;
  /** That paragraph's words, the ones the helper-words picker numbers. */
  paragraphText: string;
  /** Where it sits, for the top bar ("Slide 2"). */
  slideLabel: string | null;
  /** On a praise: its words, the coach's or the signed line the item
   *  carries. Never made up here; none means none is shown. */
  praiseWords?: readonly string[] | null;
  clip?: WalkClip | null;
  /** On a served rewrite: the speaker's words it anchors on (`quote`), the
   *  words offered in their place (`proposedText`), and the item itself for
   *  the decision. Only from the served item; never made up. */
  rewrite?: { quote: string; proposedText: string; item: R } | null;
};

/** A moment's clearer version: the served pair as pieces, the words to say
 *  once accepted, and the item the decision is written on. */
export type FeedbackWalkClearer<R = unknown> = ClearerPieces & {
  say: string;
  item: R;
};

/** One moment of the walk, ready to draw. */
export type FeedbackWalkMoment<R = unknown> = {
  index: number;
  partId: string;
  paragraphText: string;
  slideLabel: string | null;
  praiseWords: readonly string[];
  clip: WalkClip | null;
  /** The clearer version, when the moment has a served rewrite. */
  clearer: FeedbackWalkClearer<R> | null;
};

export type FeedbackWalkModel<R = unknown> = {
  plan: WalkStep[];
  moments: FeedbackWalkMoment<R>[];
  /** The paragraphs each moment touches, by moment index. */
  partsOf: string[][];
};

/** The screens this phase draws (D-FW-14, D-FW-15). The rest of the plan
 *  waits for D-FW-16/17/18/20. */
export const WALK_PHASE_SCREENS: ReadonlySet<WalkStepKey> = new Set<WalkStepKey>([
  "page",
  "coachnote",
  "praise",
  "helpers",
  "clearer",
  "end",
]);

const isPraise = (i: FeedbackWalkItem) =>
  i.openCard === "praise" || i.feedbackFamily === "great_formulation";

function clearerOf<R>(group: readonly FeedbackWalkItem<R>[]): FeedbackWalkClearer<R> | null {
  for (const i of group) {
    if (!i.rewrite) continue;
    const pieces = clearerPieces(i.rewrite.quote, i.rewrite.proposedText);
    if (pieces) return { ...pieces, say: i.rewrite.proposedText.trim(), item: i.rewrite.item };
  }
  return null;
}

function momentOf<R>(group: readonly FeedbackWalkItem<R>[], index: number): FeedbackWalkMoment<R> {
  const praise = group.find(isPraise);
  const rewrite = group.find((i) => i.rewrite);
  const lead = praise ?? rewrite ?? group[0];
  const clip = praise?.clip ?? rewrite?.clip ?? group.find((i) => i.clip)?.clip ?? null;
  return {
    index,
    partId: lead.partId,
    paragraphText: lead.paragraphText,
    slideLabel: lead.slideLabel,
    praiseWords: praise?.praiseWords ?? [],
    clip,
    clearer: clearerOf(group),
  };
}

/** The walk for one Take, as this phase draws it. A clearer version is drawn
 *  only where the served rewrite is there to draw it from. */
export function buildFeedbackWalk<R = unknown>(input: {
  items: readonly FeedbackWalkItem<R>[];
  coachNote: boolean;
  practiceOn: boolean;
  guest: boolean;
}): FeedbackWalkModel<R> {
  const groups = walkMomentGroups(input.items);
  const moments = groups.map((group, index) => momentOf(group, index));
  const plan = buildWalkPlan({
    moments: walkMoments(input.items),
    coachNote: input.coachNote,
    practiceOn: input.practiceOn,
    guest: input.guest,
  }).filter(
    (step) =>
      WALK_PHASE_SCREENS.has(step.key) &&
      (step.key !== "clearer" || (step.moment != null && moments[step.moment]?.clearer != null)),
  );
  return {
    plan,
    moments,
    partsOf: groups.map((group) => [...new Set(group.map((i) => i.partId))]),
  };
}

/** The signed line for the `turn`-th screen of its kind in the walk: the
 *  bank's lines in order, so two screens in a row never share one (the line
 *  bank's rotation rule, N54). The first is the line the lock shows. */
export function bankLine(lines: readonly string[], turn: number): string {
  return lines[((turn % lines.length) + lines.length) % lines.length];
}

/** How many clearer versions come before step `at` in the plan: the turn
 *  its bank lines rotate by. */
export function clearerTurn(plan: readonly WalkStep[], at: number): number {
  return plan.slice(0, Math.max(0, at)).filter((s) => s.key === "clearer").length;
}

/** Where "Review feedback" opens the walk: its first screen. Null when this
 *  phase has nothing to show (no coach's note, no praise, no clearer
 *  version). */
export function walkStart(model: FeedbackWalkModel<unknown>): number | null {
  const at = model.plan.findIndex((step) => step.overlay !== false);
  return at >= 0 ? at : null;
}

/** Where a tap on a paragraph opens the walk (Q-B3 A): its moment's first
 *  screen. Null when no moment of the walk is on it, or when this phase
 *  draws none of its screens. */
export function walkStepForPart(model: FeedbackWalkModel<unknown>, partId: string): number | null {
  for (let moment = 0; moment < model.partsOf.length; moment += 1) {
    if (!model.partsOf[moment].includes(partId)) continue;
    const at = stepForMoment(model.plan, moment);
    if (at !== null) return at;
  }
  return null;
}
