/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK, AS MOUNTED (build plan D-FW-14; founder lock            */
/*  2026-10-06; N53.3 NX1 A, N63 Q-B3 A).                                      */
/*                                                                            */
/*  Pure: from the Take's feedback items, as the page holds them, the walk's   */
/*  plan (walkPlan.ts) cut to the screens this phase draws, and each moment's */
/*  paragraph, player and praise words so a screen can be drawn from its      */
/*  step alone.                                                               */
/*                                                                            */
/*  THIS PHASE draws the coach's note, the praise and the helper words, then  */
/*  the end card. The other screens of the plan are left out here, not drawn  */
/*  half-built:                                                               */
/*    TODO(D-FW-15) the clearer version · TODO(D-FW-16) the exercise video    */
/*    TODO(D-FW-17) practising and the machine's check                        */
/*    TODO(D-FW-18) "Judgement time!" and the judgements                      */
/*    TODO(D-FW-20) sharing                                                   */
/*                                                                            */
/*  No number, read or score is an input or an output (AC-9). The words are   */
/*  the caller's, already signed: this file adds none.                        */
/* -------------------------------------------------------------------------- */

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

/** One feedback item as the walk needs it. */
export type FeedbackWalkItem = WalkFeedbackItem & {
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
};

/** One moment of the walk, ready to draw. */
export type FeedbackWalkMoment = {
  index: number;
  partId: string;
  paragraphText: string;
  slideLabel: string | null;
  praiseWords: readonly string[];
  clip: WalkClip | null;
};

export type FeedbackWalkModel = {
  plan: WalkStep[];
  moments: FeedbackWalkMoment[];
  /** The paragraphs each moment touches, by moment index. */
  partsOf: string[][];
};

/** The screens this phase draws (D-FW-14). The rest of the plan waits for
 *  D-FW-15/16/17/18/20. */
export const WALK_PHASE_SCREENS: ReadonlySet<WalkStepKey> = new Set<WalkStepKey>([
  "page",
  "coachnote",
  "praise",
  "helpers",
  "end",
]);

const isPraise = (i: FeedbackWalkItem) =>
  i.openCard === "praise" || i.feedbackFamily === "great_formulation";

function momentOf(group: readonly FeedbackWalkItem[], index: number): FeedbackWalkMoment {
  const praise = group.find(isPraise);
  const lead = praise ?? group[0];
  const clip = praise?.clip ?? group.find((i) => i.clip)?.clip ?? null;
  return {
    index,
    partId: lead.partId,
    paragraphText: lead.paragraphText,
    slideLabel: lead.slideLabel,
    praiseWords: praise?.praiseWords ?? [],
    clip,
  };
}

/** The walk for one Take, as this phase draws it. */
export function buildFeedbackWalk(input: {
  items: readonly FeedbackWalkItem[];
  coachNote: boolean;
  practiceOn: boolean;
  guest: boolean;
}): FeedbackWalkModel {
  const groups = walkMomentGroups(input.items);
  const plan = buildWalkPlan({
    moments: walkMoments(input.items),
    coachNote: input.coachNote,
    practiceOn: input.practiceOn,
    guest: input.guest,
  }).filter((step) => WALK_PHASE_SCREENS.has(step.key));
  return {
    plan,
    moments: groups.map(momentOf),
    partsOf: groups.map((group) => [...new Set(group.map((i) => i.partId))]),
  };
}

/** Where "Review feedback" opens the walk: its first screen. Null when this
 *  phase has nothing to show (no coach's note, no praise). */
export function walkStart(model: FeedbackWalkModel): number | null {
  const at = model.plan.findIndex((step) => step.overlay !== false);
  return at >= 0 ? at : null;
}

/** Where a tap on a paragraph opens the walk (Q-B3 A): its moment's first
 *  screen. Null when no moment of the walk is on it, or when this phase
 *  draws none of its screens. */
export function walkStepForPart(model: FeedbackWalkModel, partId: string): number | null {
  for (let moment = 0; moment < model.partsOf.length; moment += 1) {
    if (!model.partsOf[moment].includes(partId)) continue;
    const at = stepForMoment(model.plan, moment);
    if (at !== null) return at;
  }
  return null;
}
