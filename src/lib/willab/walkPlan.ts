/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK'S PLAN (build plan D-FW-13; founder lock 2026-10-06,     */
/*  flow 2-12; N52.2, N62 Q-B2 A, N63 Q-B3 A).                                  */
/*                                                                            */
/*  Pure: from a Take's moments, the coach's word for the Take and the         */
/*  speaker's situation, the locked order of screens:                          */
/*                                                                            */
/*    the page → the coach's note (only when there is one) → every praise,    */
/*    each followed by its helper words → the practising (a clearer version,  */
/*    an exercise, or the moment said again) → "Judgement time!" → one         */
/*    judgement per moment still open → sharing → the end card.               */
/*                                                                            */
/*  With several slides the walk spans the whole Take (Q-B2 A): all praise    */
/*  from every slide, then all the practising, then one "Judgement time!".   */
/*  Each step about a moment carries its slide, for the top bar.              */
/*                                                                            */
/*  What happens after a try (checking, then praise or encouragement, up to   */
/*  three tries; CM3a A) is decided live by the machine; `afterTry` gives the  */
/*  next screens for one answer, and `withOutcomes` lays a whole sequence of  */
/*  answers into the plan (the harness's ?flow=1 is one such sequence).       */
/*                                                                            */
/*  No number, read or score is an input or an output (AC-9): a moment is a   */
/*  kind of feedback, never a measurement.                                    */
/* -------------------------------------------------------------------------- */

import type { WalkScreen } from "./walkMotion";

/** The tries a practise allows before the walk thanks the speaker and moves
 *  on (founder 2026-10-06, CM3a A, "Up to 3"). */
export const WALK_MAX_TRIES = 3;

/** One moment of the Take, in page order. */
export type WalkMoment = {
  /** Position on the page (0-based), the moment's identity in the walk. */
  index: number;
  /** The slide it was said on (0-based), for the top bar. */
  slide: number;
  /** A praise for this moment (the coach's words or a signed app line). */
  praise?: boolean;
  /** A clearer version of the speaker's words. */
  clearer?: boolean;
  /** An exercise to practise (the coach's video or the library's). */
  exercise?: boolean;
  /** Something to practise with nothing attached: the moment said again
   *  (contract 29a: the plain moment when no exercise or rewrite fits). */
  practise?: boolean;
  /** Already judged: no judgement step is planned for it. */
  judged?: boolean;
};

export type WalkPlanInput = {
  moments: readonly WalkMoment[];
  /** The coach has a word for this Take (their video and/or their words). */
  coachNote: boolean;
  /** Personalised practice is on. Off: a clearer version offers "Accept" and
   *  "Keep my words" with no practise, and nothing else is practised
   *  (N55 WQ3 A, WQ3c A). */
  practiceOn: boolean;
  /** A guest: every screen is shown read-only, and any answer, pick or
   *  practise opens sign-up instead of writing (N32.5). */
  guest: boolean;
  /** Sharing is offered after a finished review (N52.4); false hides it. */
  sharing?: boolean;
};

/** Every screen the plan can name. */
export type WalkStepKey =
  | "page"
  | "coachnote"
  | "praise"
  | "helpers"
  | "clearer"
  | "exVideo"
  | "practise"
  | "processing"
  | "improved"
  | "encourage"
  | "thanks"
  | "intro"
  | "judge"
  | "community"
  | "end";

export type WalkStep = WalkScreen & {
  key: WalkStepKey;
  /** The slide of the moment, for the top bar. */
  slide?: number;
  /** Shown to a guest: an answer, pick or practise opens sign-up. */
  readOnly?: boolean;
};

/** The machine's answer to one try (D-FW-1): praise ends the loop. */
export type TryOutcome = "praise" | "again";

const momentStep = (m: WalkMoment, key: WalkStepKey, extra: Partial<WalkStep> = {}): WalkStep => ({
  key,
  moment: m.index,
  slide: m.slide,
  ...extra,
});

/** The screens one practise moment opens with, before the first try. */
function practiseOpening(m: WalkMoment, practiceOn: boolean): WalkStep[] {
  if (m.clearer) {
    if (!practiceOn) return [momentStep(m, "clearer", { kind: "accept" })];
    return [momentStep(m, "clearer"), momentStep(m, "practise", { kind: "words", attempt: 1 })];
  }
  if (!practiceOn) return [];
  if (m.exercise) {
    return [momentStep(m, "exVideo"), momentStep(m, "practise", { kind: "instruction", attempt: 1 })];
  }
  if (m.practise) return [momentStep(m, "practise", { kind: "moment", attempt: 1 })];
  return [];
}

const isPractiseMoment = (m: WalkMoment) => Boolean(m.clearer || m.exercise || m.practise);

/** The whole walk for one Take, in the locked order. */
export function buildWalkPlan(input: WalkPlanInput): WalkStep[] {
  const moments = [...input.moments].sort((a, b) => a.index - b.index);
  const steps: WalkStep[] = [{ key: "page", overlay: false }];
  if (input.coachNote) steps.push({ key: "coachnote" });
  for (const m of moments) {
    if (!m.praise) continue;
    steps.push(momentStep(m, "praise"), momentStep(m, "helpers"));
  }
  for (const m of moments) {
    if (isPractiseMoment(m)) steps.push(...practiseOpening(m, input.practiceOn));
  }
  const open = moments.filter((m) => !m.judged);
  if (open.length > 0) {
    steps.push({ key: "intro" });
    for (const m of open) steps.push(momentStep(m, "judge"));
  }
  if (input.sharing !== false) steps.push({ key: "community" });
  steps.push({ key: "end", overlay: false });
  if (!input.guest) return steps;
  return steps.map((s) => (s.key === "page" || s.key === "end" ? s : { ...s, readOnly: true }));
}

/** The screens that follow one answer from the machine on a practise try.
 *  Praise: the praise after a try, then helper words. Again: encouragement,
 *  then the next try; after the last allowed try that is not praise, the
 *  signed thank-you (CM3b) and the walk moves on. */
export function afterTry(practise: WalkStep, outcome: TryOutcome): WalkStep[] {
  const attempt = practise.attempt ?? 1;
  const base = { moment: practise.moment, slide: practise.slide, ...(practise.readOnly ? { readOnly: true } : {}) };
  const checking: WalkStep = { key: "processing", ...base, attempt };
  if (outcome === "praise") {
    return [checking, { key: "improved", ...base, attempt }, { key: "helpers", ...base }];
  }
  if (attempt >= WALK_MAX_TRIES) return [checking, { key: "thanks", ...base, attempt }];
  return [
    checking,
    { key: "encourage", ...base, attempt },
    { ...practise, attempt: attempt + 1 },
  ];
}

/** The plan with a sequence of machine answers laid in, moment by moment.
 *  A moment with fewer answers than tries ends where its answers end: the
 *  speaker skipped (Skip works at any time). */
export function withOutcomes(
  plan: readonly WalkStep[],
  outcomes: Readonly<Record<number, readonly TryOutcome[]>>,
): WalkStep[] {
  const out: WalkStep[] = [];
  for (const step of plan) {
    out.push(step);
    if (step.key !== "practise" || step.moment == null) continue;
    let current: WalkStep = step;
    const answers = outcomes[step.moment] ?? [];
    for (let i = 0; i < answers.length; i += 1) {
      const next = afterTry(current, answers[i]);
      const nextTry = next.find((s) => s.key === "practise");
      if (nextTry && i + 1 < answers.length) {
        out.push(...next);
        current = nextTry;
        continue;
      }
      out.push(...next.filter((s) => s.key !== "practise"));
      break;
    }
  }
  return out;
}

/** Where a tap on a paragraph opens the walk (Q-B3 A): at that moment's
 *  first screen while it has something open. Null when it has none — an
 *  answered or saved paragraph opens its own screen, not the walk. */
export function stepForMoment(plan: readonly WalkStep[], moment: number): number | null {
  const at = plan.findIndex((s) => s.moment === moment && s.key !== "judge");
  if (at >= 0) return at;
  const judge = plan.findIndex((s) => s.moment === moment && s.key === "judge");
  return judge >= 0 ? judge : null;
}

/** One feedback item on the page, as far as the walk cares. The page maps
 *  its served items to this (the slide comes from the paragraph the item
 *  sits in). `openCard` is the backend's routing word (N48.1), never a read. */
export type WalkFeedbackItem = {
  /** Where the item sits in the served text; orders the moments. */
  start: number;
  slide: number;
  /** The ~75-word block it was selected in: one moment per block. */
  blockId?: string | null;
  openCard?: "praise" | "exercise" | "coach_request" | "rewrite" | null;
  feedbackFamily?: "confident_voice" | "great_formulation" | "rewrite_clarity" | null;
  /** An exercise (the coach's or the library's) rides this item. */
  hasExercise?: boolean;
  /** The speaker already judged it. */
  judged?: boolean;
};

/** The feedback items grouped into the Take's moments, in page order: one
 *  group per block (an item with no block is a moment of its own). A
 *  group's position is its moment's `index`, so a caller holding richer
 *  items (the walk's player, words and paragraph) finds them again here. */
export function walkMomentGroups<T extends WalkFeedbackItem>(items: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const key = item.blockId ? `b:${item.blockId}` : `s:${item.start}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()];
}

/** The Take's moments from its feedback items, in page order: one moment
 *  per block, carrying every kind of feedback its items name. */
export function walkMoments(items: readonly WalkFeedbackItem[]): WalkMoment[] {
  return walkMomentGroups(items).map((group, index) => {
    const has = (pred: (i: WalkFeedbackItem) => boolean) => group.some(pred);
    const praise = has((i) => i.openCard === "praise" || i.feedbackFamily === "great_formulation");
    const clearer = has((i) => i.openCard === "rewrite" || i.feedbackFamily === "rewrite_clarity");
    const exercise = has((i) => i.openCard === "exercise" || Boolean(i.hasExercise));
    const practise = !clearer && !exercise && has((i) => i.openCard === "coach_request");
    return {
      index,
      slide: group[0].slide,
      ...(praise ? { praise } : {}),
      ...(clearer ? { clearer } : {}),
      ...(exercise ? { exercise } : {}),
      ...(practise ? { practise } : {}),
      ...(has((i) => Boolean(i.judged)) ? { judged: true } : {}),
    };
  });
}
