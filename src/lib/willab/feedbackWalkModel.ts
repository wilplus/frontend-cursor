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
/*  clearer version (D-FW-15), the practise loop on the accepted words or the */
/*  moment said again (D-FW-16; the machine's check lays its screens in live, */
/*  walkPractise.ts), the exercise (D-FW-17: its video, then the practise on  */
/*  its instruction), "Judgement time!" and one judgement per moment still    */
/*  open (D-FW-18: only where the moment's Confident Voice item is there to   */
/*  save the speaker's answer on), sharing (D-FW-20: after the review, only  */
/*  where the host turns it on), then the end card.                           */
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
   *  the decision. Only from the served item; never made up. `move` is the
   *  served item's signed sentence for the rewrite (`rewriteMove`, 35f), the
   *  coach's line above the words to say on the practise; absent, none. */
  rewrite?: { quote: string; proposedText: string; move?: string | null; item: R } | null;
  /** The served item itself, set only where a practise can be opened on it
   *  (its clearer version's words, or the moment said again). Only handed
   *  back. */
  item?: R | null;
  /** The exercise this item's follow-up opens on (the follow-up matrix's
   *  exercise cell, or one the coach chose), with the served item it is
   *  practised on. Only from the served offer; never made up. */
  exercise?: FeedbackWalkItemExercise<R> | null;
  /** On the Confident Voice item still waiting for the speaker's judgement:
   *  the item itself, the one the speaker's own answer is saved on (L3).
   *  Only handed back. */
  judge?: R | null;
};

/** An exercise as an item carries it: its video (the coach's when the coach
 *  chose it, else the library's), its instruction and the words to say. */
export type FeedbackWalkItemExercise<R = unknown> = {
  /** The served video, as the Feedback sheet plays it; null: none. */
  video: string | null;
  /** The coach chose this exercise: its video is the coach's. */
  byCoach: boolean;
  instruction: string | null;
  /** The words the practise is checked against. */
  say: string;
  item: R;
};

/** A moment's exercise, ready to draw: the video that plays before the
 *  practise (null: the walk goes straight to the practise, Q-B15 A), the
 *  instruction, the words to say and the item the practise is opened on. */
export type FeedbackWalkExercise<R = unknown> = {
  video: string | null;
  instruction: string | null;
  say: string;
  item: R;
};

/** A moment's clearer version: the served pair as pieces, the words to say
 *  once accepted, the served line above them on the practise (null: none),
 *  and the item the decision is written on. */
export type FeedbackWalkClearer<R = unknown> = ClearerPieces & {
  say: string;
  coachLine: string | null;
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
  /** The item the moment's practise is opened on: its served rewrite, or
   *  the moment to say again. None: nothing to practise here. */
  practiseItem: R | null;
  /** The moment's exercise (D-FW-17), when one is served on it. */
  exercise: FeedbackWalkExercise<R> | null;
  /** The Confident Voice item the moment's judgement is saved on (D-FW-18).
   *  None: the moment has no judgement screen. */
  judgeItem: R | null;
};

export type FeedbackWalkModel<R = unknown> = {
  plan: WalkStep[];
  moments: FeedbackWalkMoment<R>[];
  /** The paragraphs each moment touches, by moment index. */
  partsOf: string[][];
};

/** The screens this phase draws (D-FW-14 to D-FW-18, sharing D-FW-20).
 *  The practise loop's later screens
 *  (checking, praise, encouragement, the thank-you, a late read) are laid in
 *  live by walkPractise.ts, never planned ahead. */
export const WALK_PHASE_SCREENS: ReadonlySet<WalkStepKey> = new Set<WalkStepKey>([
  "page",
  "coachnote",
  "praise",
  "helpers",
  "clearer",
  "exVideo",
  "practise",
  "intro",
  "judge",
  "community",
  "end",
]);

/** A practise this phase records, where its item is there to open it on:
 *  the accepted words of a clearer version it draws, the moment's exercise,
 *  or the moment said again. */
function drawnPractise<R>(step: WalkStep, moment: FeedbackWalkMoment<R> | undefined): boolean {
  if (step.key !== "practise") return true;
  if (step.kind === "instruction") return moment?.exercise != null;
  if (moment?.practiseItem == null) return false;
  if (step.kind === "words") return moment.clearer != null;
  return step.kind === "moment";
}

/** The exercise video's screen is drawn only where there is a video to
 *  play: the coach's, else the library's. With none the walk goes straight
 *  to the practise (Q-B15 A). Never a screen that waits for a coach
 *  (WQ2 B). */
function drawnVideo<R>(step: WalkStep, moment: FeedbackWalkMoment<R> | undefined): boolean {
  return step.key !== "exVideo" || moment?.exercise?.video != null;
}

/** The moment's exercise from the ones its items carry: the coach's video
 *  first, then the library's; with no video at all, the exercise is still
 *  practised, straight away (Q-B15 A). Pure. */
export function pickExercise<R>(
  offers: readonly FeedbackWalkItemExercise<R>[],
): FeedbackWalkExercise<R> | null {
  const withVideo = (o: FeedbackWalkItemExercise<R>) => Boolean(o.video?.trim());
  const pick =
    offers.find((o) => o.byCoach && withVideo(o)) ??
    offers.find(withVideo) ??
    offers.find((o) => o.byCoach) ??
    offers[0];
  if (!pick) return null;
  return {
    video: withVideo(pick) ? (pick.video as string).trim() : null,
    instruction: pick.instruction?.trim() || null,
    say: pick.say,
    item: pick.item,
  };
}

const isPraise = (i: FeedbackWalkItem) =>
  i.openCard === "praise" || i.feedbackFamily === "great_formulation";

function clearerOf<R>(group: readonly FeedbackWalkItem<R>[]): FeedbackWalkClearer<R> | null {
  for (const i of group) {
    if (!i.rewrite) continue;
    const pieces = clearerPieces(i.rewrite.quote, i.rewrite.proposedText);
    if (pieces) {
      const coachLine = i.rewrite.move?.trim() || null;
      return { ...pieces, say: i.rewrite.proposedText.trim(), coachLine, item: i.rewrite.item };
    }
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
    practiseItem:
      group.find((i) => i.item != null && (i.rewrite != null || i.openCard === "coach_request"))?.item ?? null,
    exercise: pickExercise(group.flatMap((i) => (i.exercise ? [i.exercise] : []))),
    judgeItem: group.find((i) => i.judge != null)?.judge ?? null,
  };
}

/** "Judgement time!" stands only in front of a judgement it opens. */
function withoutLoneIntro(plan: WalkStep[]): WalkStep[] {
  if (plan.some((step) => step.key === "judge")) return plan;
  return plan.filter((step) => step.key !== "intro");
}

/** Sharing follows a review (flow 11): it never stands as the walk's only
 *  screen, so "Review feedback" with nothing to review opens nothing. */
function withoutLoneSharing(plan: WalkStep[]): WalkStep[] {
  if (plan.some((step) => step.overlay !== false && step.key !== "community")) return plan;
  return plan.filter((step) => step.key !== "community");
}

/** The walk for one Take, as this phase draws it. A clearer version is drawn
 *  only where the served rewrite is there to draw it from. */
export function buildFeedbackWalk<R = unknown>(input: {
  items: readonly FeedbackWalkItem<R>[];
  coachNote: boolean;
  practiceOn: boolean;
  guest: boolean;
  /** Sharing is asked after the review (D-FW-20): only where the server's
   *  communities are on and there is a Take to share. Absent: off. */
  sharing?: boolean;
}): FeedbackWalkModel<R> {
  const groups = walkMomentGroups(input.items);
  const moments = groups.map((group, index) => momentOf(group, index));
  const plan = buildWalkPlan({
    moments: walkMoments(input.items),
    coachNote: input.coachNote,
    practiceOn: input.practiceOn,
    guest: input.guest,
    sharing: input.sharing === true,
  }).filter((step) => {
    const moment = step.moment == null ? undefined : moments[step.moment];
    return (
      WALK_PHASE_SCREENS.has(step.key) &&
      drawnPractise(step, moment) &&
      drawnVideo(step, moment) &&
      (step.key !== "clearer" || moment?.clearer != null) &&
      (step.key !== "judge" || moment?.judgeItem != null)
    );
  });
  return {
    plan: withoutLoneSharing(withoutLoneIntro(plan)),
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
 *  phase has nothing to show (no coach's note, no praise, no practise, no
 *  judgement). */
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

/** Where the walk goes once the judging is over, by the judgements or by
 *  Skip on "Judgement time!" (Q-B6 A): the step after the last judgement,
 *  which is sharing where it is on (D-FW-20), else the end card. */
export function afterJudging(plan: readonly WalkStep[]): number {
  let last = -1;
  plan.forEach((step, i) => {
    if (step.key === "intro" || step.key === "judge") last = i;
  });
  return Math.min(last + 1, plan.length - 1);
}

/** The moments the judging still holds open: every judgement in the plan
 *  the speaker has not answered in this walk. Skip settles them. */
export function unansweredJudgements(
  plan: readonly WalkStep[],
  answered: Readonly<Record<number, unknown>>,
): number[] {
  const out: number[] = [];
  for (const step of plan) {
    if (step.key !== "judge" || step.moment == null) continue;
    if (answered[step.moment] === undefined && !out.includes(step.moment)) out.push(step.moment);
  }
  return out;
}

/** The first judgement of the walk: its ‹ is off ("Judgement time!" is not
 *  gone back to, as in the prototype). */
export function firstJudgement(plan: readonly WalkStep[], at: number): boolean {
  return plan[at]?.key === "judge" && plan[at - 1]?.key !== "judge";
}
