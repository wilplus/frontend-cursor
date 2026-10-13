/* -------------------------------------------------------------------------- */
/*  THE PRACTISE LOOP, LIVE (build plan D-FW-16; founder lock 2026-10-06,      */
/*  flow 7; N52.3, NX3 A, CM3a A, CM3b A, O5).                                 */
/*                                                                            */
/*  Pure. The walk's plan holds one practise screen per moment; what follows   */
/*  a try is decided live by the machine (services/practice_check.py in the   */
/*  backend), and these functions lay its answer into the plan:               */
/*                                                                            */
/*    Stop            → checking (the breathing voice mark)                    */
/*    praise          → the line for the reading that moved (option A), then    */
/*                      on to judging others (lock 2026-10-12, section 2.5)    */
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

import { PRACTISE_LINES, type PractiseCueKey } from "@/components/willab/idealEditCopy";
import type { SayLine } from "./walkLines";
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
 *  version that opens it): Skip, "Keep my words" and "Next" go there. */
export function loopEnd(plan: readonly WalkStep[], at: number): number {
  const moment = plan[at]?.moment;
  let to = at + 1;
  while (to < plan.length && plan[to].moment === moment && LOOP.has(plan[to].key)) to += 1;
  return Math.min(to, plan.length - 1);
}

/** The steps that pile up in the voice Exercise's one thread (founder
 *  2026-10-13, P1 A): the Exercise and its practise loop. */
const THREAD: ReadonlySet<WalkStepKey> = new Set<WalkStepKey>(["exVideo", ...LOOP]);

/** Where the voice Exercise's thread that `at` sits in starts: the Exercise,
 *  else its first try; -1 when `at` is not in one (a clearer version's
 *  practise, any other screen). */
export function threadStart(plan: readonly WalkStep[], at: number): number {
  const moment = plan[at]?.moment;
  if (moment == null || !THREAD.has(plan[at].key)) return -1;
  let start = -1;
  for (let i = at; i >= 0; i -= 1) {
    const s = plan[i];
    if (s.moment !== moment || !THREAD.has(s.key)) return start;
    if (s.key === "exVideo") return i;
    if (s.key === "practise") {
      if (s.kind !== "instruction") return start;
      start = i;
    }
  }
  return start;
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
 *  "late" screen, whose `attempt` is the try "Practise again" records. */
export function withRead(
  plan: readonly WalkStep[],
  at: number,
  practise: WalkStep,
  read: PractiseRead | null,
  opts: { retryAttempt?: number } = {},
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
    .map((s): WalkStep => {
      if (s.key === "improved") return { ...s, kind: read.key ?? undefined };
      if (s.key === "encourage") return { ...s, kind: read.key ?? "effort" };
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

/** The reading a key names: "cue:x" (it moved toward confident) or
 *  "miss:x" (it went the other way); null for any other key. */
function cueOf(key: string | null | undefined, prefix: "cue:" | "miss:"): PractiseCueKey | null {
  if (!key?.startsWith(prefix)) return null;
  const cue = key.slice(prefix.length);
  return cue in PRACTISE_LINES.better && cue !== "general" ? (cue as PractiseCueKey) : null;
}

/** A reading's three lines in turn, from a random start (founder
 *  2026-10-13: three per reading, mixed, never another reading's). */
function inTurn(
  plan: readonly WalkStep[],
  at: number,
  key: "improved" | "encourage",
  prefix: "cue:" | "miss:",
  lines: readonly string[],
): string {
  const cue = cueOf(plan[at]?.kind, prefix) ?? "general";
  const turn = plan
    .slice(0, Math.max(0, at))
    .filter((s) => s.key === key && (cueOf(s.kind, prefix) ?? "general") === cue).length;
  return lines[(START + turn) % lines.length];
}

/** Where a reading's turns start on this page: random, so all three lines
 *  come up across walks (founder 2026-10-13, "use all 3 interchangeably");
 *  fixed for the page, so a line never changes while it is on screen and
 *  never repeats back to back. */
const START = Math.floor(Math.random() * 3);

/** The praise after a try at `at`: a line for the reading that moved
 *  toward confident, else a general one (founder 2026-10-13, option A). */
export function improvedLine(plan: readonly WalkStep[], at: number, _say?: SayLine): string {
  const cue = cueOf(plan[at]?.kind, "cue:");
  return inTurn(plan, at, "improved", "cue:", PRACTISE_LINES.better[cue ?? "general"]);
}

/** The line for the reading the "not yet" at `at` named, or null when none
 *  clearly moved: the voice Exercise's AI bubble opens with it (founder
 *  2026-10-13, B). */
export function missLine(plan: readonly WalkStep[], at: number): string | null {
  const cue = cueOf(plan[at]?.kind, "miss:");
  return cue ? inTurn(plan, at, "encourage", "miss:", PRACTISE_LINES.notYet[cue]) : null;
}

/** The "not yet" at `at`: a line for the reading that went the wrong way,
 *  else a general one (option A). */
export function encourageLine(plan: readonly WalkStep[], at: number, _say?: SayLine): string {
  return missLine(plan, at) ?? inTurn(plan, at, "encourage", "miss:", PRACTISE_LINES.notYet.general);
}

/** The line after the third try that is not praise (CM3b A): one line. */
export function thanksLine(_plan: readonly WalkStep[], _at: number, _say?: SayLine): string {
  return PRACTISE_LINES.movedOn;
}
