/* -------------------------------------------------------------------------- */
/*  THE PRACTISE LOOP, LIVE (build plan D-FW-16; founder lock 2026-10-06,      */
/*  flow 7; N52.3, NX3 A, CM3a A, CM3b A, O5).                                 */
/*                                                                            */
/*  Pure. The walk's plan holds one practise screen per moment; what follows   */
/*  a try is decided live by the machine (services/practice_check.py in the   */
/*  backend), and these functions lay its answer into the plan:               */
/*                                                                            */
/*    Stop            → checking (the breathing voice mark)                    */
/*    praise          → the praise after a try, from the signed bank, then     */
/*                      helper words tapped from the try's own words           */
/*    again           → "It was better, …" when something moved between tries */
/*                      (key "step"), else a rotating NX3a line (key          */
/*                      "effort"), then the next try                          */
/*    moved_on        → after the third try that is not praise: a rotating    */
/*                      CM3b line, and the walk moves on                      */
/*    late or failed  → "Next" or "Practise again" (O5): the try is treated as */
/*                      not reached yet, never as a verdict                    */
/*                                                                            */
/*  What the walk may know of a check is `next` and the line's `key`; no      */
/*  score, lane, cue value or count of anything measured is an input or an     */
/*  output here (AC-9). The words are the signed ones (WALK_COPY,              */
/*  WALK_LINE_BANK); this file only picks among them.                        */
/* -------------------------------------------------------------------------- */

import { WALK_COPY, WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import { bankLine } from "./feedbackWalkModel";
import { WALK_MAX_TRIES, afterTry, type WalkStep, type WalkStepKey } from "./walkPlan";

/** O5: a read later than this is "not reached yet"; the walk offers Next or
 *  Practise again and never waits longer. */
export const PRACTISE_READ_LIMIT_MS = 5000;

/** The machine's answer about one try, as the walk may see it. */
export type PractiseRead = {
  next: "praise" | "again" | "moved_on";
  key: string | null;
};

/** The screens of one moment's practise loop. */
const LOOP: ReadonlySet<WalkStepKey> = new Set<WalkStepKey>([
  "practise",
  "processing",
  "improved",
  "encourage",
  "thanks",
  "late",
]);

/** The index after the practise loop that `at` sits in (or the clearer
 *  version that opens it): Skip, "Keep my words" and "Next" go there. A
 *  helper-words screen laid in after a praised try belongs to the loop too. */
export function loopEnd(plan: readonly WalkStep[], at: number): number {
  const moment = plan[at]?.moment;
  let to = at + 1;
  while (
    to < plan.length &&
    plan[to].moment === moment &&
    (LOOP.has(plan[to].key) || (plan[to].key === "helpers" && plan[to].kind === "try"))
  ) {
    to += 1;
  }
  return Math.min(to, plan.length - 1);
}

/** Stop on the try at `at`: the checking screen follows it, and whatever
 *  this loop had planned after it is dropped until the machine answers. */
export function withChecking(plan: readonly WalkStep[], at: number): WalkStep[] {
  const practise = plan[at];
  const checking: WalkStep = {
    key: "processing",
    moment: practise.moment,
    slide: practise.slide,
    attempt: practise.attempt,
    ...(practise.readOnly ? { readOnly: true } : {}),
  };
  return [...plan.slice(0, at + 1), checking, ...plan.slice(loopEnd(plan, at))];
}

/** The machine's answer laid in after the checking screen at `at`.
 *  `practise` is the try that was checked, its `attempt` the try's number as
 *  the server counts it. A null read is a late or failed one (O5): the
 *  "late" screen, whose `attempt` is the try "Practise again" records.
 *  `words`: the try's own words came back, so helper words can follow a
 *  praise; without them no helper-words screen is laid in. */
export function withRead(
  plan: readonly WalkStep[],
  at: number,
  practise: WalkStep,
  read: PractiseRead | null,
  opts: { words: boolean; retryAttempt?: number },
): WalkStep[] {
  const head = plan.slice(0, at + 1);
  const rest = plan.slice(loopEnd(plan, at));
  const base = { moment: practise.moment, slide: practise.slide, ...(practise.readOnly ? { readOnly: true } : {}) };
  if (read === null) {
    const retry = opts.retryAttempt ?? (practise.attempt ?? 1);
    return [...head, { key: "late", ...base, attempt: retry }, ...rest];
  }
  const attempt = practise.attempt ?? 1;
  const asked = read.next === "moved_on" ? { ...practise, attempt: Math.max(attempt, WALK_MAX_TRIES) } : practise;
  const next = afterTry(asked, read.next === "praise" ? "praise" : "again")
    .filter((s) => s.key !== "processing")
    .filter((s) => s.key !== "helpers" || opts.words)
    .map((s): WalkStep => {
      if (s.key === "helpers") return { ...s, kind: "try" };
      if (s.key === "improved") return { ...s, kind: read.key ?? undefined };
      if (s.key === "encourage") return { ...s, kind: read.key === "step" ? "step" : "effort" };
      return s;
    });
  return [...head, ...next, ...rest];
}

/** "Practise again" on the late screen at `at`: the try it names, recorded
 *  in its place. */
export function withRetry(plan: readonly WalkStep[], at: number, practise: WalkStep): WalkStep[] {
  const late = plan[at];
  return [...plan.slice(0, at), { ...practise, attempt: late.attempt ?? 1 }, ...plan.slice(at + 1)];
}

/** Whether "Practise again" is offered on a late screen: only while a try
 *  is left (CM3a A, up to three). */
export const triesLeft = (late: WalkStep): boolean => (late.attempt ?? 1) <= WALK_MAX_TRIES;

/** How many screens of this kind come before `at`: the turn its lines
 *  rotate by, so two in a row never share a line (N54). */
function turnOf(plan: readonly WalkStep[], at: number, match: (s: WalkStep) => boolean): number {
  return plan.slice(0, Math.max(0, at)).filter(match).length;
}

/** The praise bank for a delivery cue (backend services/line_bank.py
 *  CUE_BANK, mirrored): an unknown or missing cue is the gentle general
 *  line, B09, never an invented one. */
export const PRACTISE_CUE_BANK: Readonly<Record<string, keyof typeof WALK_LINE_BANK>> = {
  wide_range: "B02",
  full_volume: "B03",
  no_hesitation: "B04",
  settled_pitch: "B05",
  kept_moving: "B06",
  landed_ending: "B07",
  opened_strong: "B08",
  confident: "B01",
  tentative: "B09",
};

/** The bank a praise after a try says, from the check's key
 *  (services/after_practice.py): "cue:<cue>" names its cue's bank; the
 *  machine's own read of more assurance is the general "sounded surer" bank
 *  (B01); anything else is B09. */
export function practisePraiseBank(key: string | null | undefined): keyof typeof WALK_LINE_BANK {
  if (key?.startsWith("cue:")) return PRACTISE_CUE_BANK[key.slice(4)] ?? "B09";
  if (key === "more_assured") return "B01";
  return "B09";
}

/** The praise after a try at `at`. */
export function improvedLine(plan: readonly WalkStep[], at: number): string {
  const bank = practisePraiseBank(plan[at]?.kind);
  return bankLine(WALK_LINE_BANK[bank].lines, turnOf(plan, at, (s) => s.key === "improved"));
}

/** The encouragement at `at`: the founder's own line when something moved
 *  (NX3 A), else the NX3a lines in turn. */
export function encourageLine(plan: readonly WalkStep[], at: number): string {
  if (plan[at]?.kind === "step") return WALK_COPY.encourage;
  const turn = turnOf(plan, at, (s) => s.key === "encourage" && s.kind !== "step");
  return bankLine(WALK_COPY.encourageNothingMoved, turn);
}

/** The thank-you after the third try that is not praise (CM3b A). */
export function thanksLine(plan: readonly WalkStep[], at: number): string {
  return bankLine(WALK_COPY.afterThirdTry, turnOf(plan, at, (s) => s.key === "thanks"));
}
