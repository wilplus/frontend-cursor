/* -------------------------------------------------------------------------- */
/*  The tempo step — the pace scale as a step of the Feedback walk (backend  */
/*  N162, N166; the walk's page §2 "Tempo"; prototype Tempo in the Walk      */
/*  https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV).                       */
/*                                                                            */
/*  The stretch of the Take the speaker rushed or dragged is played back;     */
/*  they talk about it again while the scale follows them. Will guides the    */
/*  tries (N245): a try that lands ends the game; one that came closer gets   */
/*  a push for one more; up to three tries, then one closing line. Pure: what */
/*  a try's path means, what Will says to it, and which line closes the step. */
/*  Words only, never a number (Never 1).                                     */
/* -------------------------------------------------------------------------- */

import { zoneLevel } from "./pace/paceSignal";

/** The rings panel's row for the step (backend rings.TEMPO_STEP, N166 step
 *  6): whoever it reaches has the step, besides the founder. */
export const TEMPO_STEP_FEATURE = "tempo_step";

/** Up to three tries (N166 item 3). */
export const TEMPO_MAX_TRIES = 3;

/** One point of a try's path every 200 ms (a minute is the backend's 300). */
export const TEMPO_PATH_EVERY_MS = 200;

/** A try lands, and the walk goes on (N245), when it runs at least 20 s
 *  from the first word and the ball stays in the green four fifths of that
 *  time. The stretch it practises spent at least a quarter of its time
 *  outside the green (backend tempo_stretch.MIN_OUTSIDE), so a landed try is
 *  always clearly better than the Take. Shorter tries cannot land: the ball
 *  needs about 10 s of talk without a pause to leave the green. */
const LAND_MIN_POINTS = 20_000 / TEMPO_PATH_EVERY_MS;
const LAND_GREEN_SHARE = 0.8;

/** The stretch the step practises: the one the scale reads furthest from
 *  the green (N166 item 1), what it was, and what it was about. */
export type TempoStretch = {
  reading: "rushed" | "slow";
  /** What the stretch was about, said back in Will's task line. */
  topic: string;
  /** The sentence around the stretch, the stretch itself marked. */
  said: { before: string; stretch: string; after: string };
  /** On a plan, this week's level's name when the step practises it ("Let
   *  your key line land", "Pauses that hold the room"; backend N289 item
   *  8): the step opens with "This week's level: {level}. Here's where it
   *  shows:". */
  planLevel?: string | null;
};

/** One try, as the step reads it from the dot's path. */
export type TempoTry = "ok" | "rush" | "slow";

/** How the step closes. */
export type TempoClose = "dynamic" | "rush" | "slow";

/** A try as played: its reading, the dot's path, and whether it landed. */
export type TempoPlayed = { result: TempoTry; path: number[]; landed: boolean };

/** What the step tells its host as it goes (N166 step 4): it opened, a try
 *  was played, or the game ended (every try, and how it ended; none when
 *  skipped before a try). The host writes the chat, each try with its line,
 *  and keeps the game for Will. */
export type TempoEvent =
  | { kind: "opened" }
  | ({ kind: "try"; n: number } & TempoPlayed)
  | { kind: "ended"; tries: TempoPlayed[]; close: TempoClose | null };

/** The try from the first word on: the quiet before it is not the pace. */
function spoken(path: readonly number[]): readonly number[] {
  const first = path.findIndex((v) => v > 0);
  return first < 0 ? [] : path.slice(first);
}

const inGreen = (v: number) => zoneLevel(v * 2 - 1) < 0.5;
const shareOf = (path: readonly number[], keep: (v: number) => boolean) =>
  path.filter(keep).length / path.length;

/** A try's path: the meter's activity, 0..1, sampled through the try.
 *  Mostly in the green: ok. Otherwise the side it spent longer on; too
 *  short to tell reads as slow. */
export function readTry(path: readonly number[]): TempoTry {
  const said = spoken(path);
  if (said.length < 5) return "slow";
  if (shareOf(said, inGreen) >= 0.5) return "ok";
  return shareOf(said, (v) => v > 0.75) >= shareOf(said, (v) => v < 0.25) ? "rush" : "slow";
}

/** Whether a try lands (N245): long enough to tell, and the ball in the
 *  green four fifths of the time. Will then lets the speaker move on. */
export function landed(path: readonly number[]): boolean {
  const said = spoken(path);
  return said.length >= LAND_MIN_POINTS && shareOf(said, inGreen) >= LAND_GREEN_SHARE;
}

/** What Will says after try `n` (N245): a landed try, and the walk goes on;
 *  a try that came closer, its comment and a push for one more while a try
 *  is left; otherwise the side it leaned to. The speaker never has to
 *  decide whether to go again. */
export function afterTry(result: TempoTry, isLanded: boolean, n: number): string[] {
  if (isLanded) return [TEMPO_COPY.landed];
  const lines: string[] = [TEMPO_COPY.comment[result]];
  if (result === "ok" && n < TEMPO_MAX_TRIES) lines.push(TEMPO_COPY.push);
  return lines;
}

/** The closing line: dynamic once a try was ok and the last one was not
 *  rushed; otherwise the side the tries leaned to. */
export function closeOf(tries: readonly TempoTry[]): TempoClose {
  const count = (t: TempoTry) => tries.filter((x) => x === t).length;
  if (count("ok") >= 1 && tries[tries.length - 1] !== "rush") return "dynamic";
  return count("rush") >= count("slow") ? "rush" : "slow";
}

/** Until the backend sends the Take's own stretch (build step 3, N166
 *  item 5), the founder walks the step on this one. */
export const TEMPO_STAND_IN: TempoStretch = {
  reading: "rushed",
  topic: "the beds for sale",
  said: {
    before: "Our new store opens on Monday.",
    stretch:
      "And the beds are on sale this week, every size, every frame, delivery is free and we take the old mattress away and it all comes with a ten year warranty",
    after: "So come and see us.",
  },
};

/** The step's words, signed by the founder 2026-10-26 (backend N179) and
 *  2026-10-28 (`landed`, `push`, backend N245; the walk's page §1 K). A
 *  change to any of them needs the founder's OK (Never 4). */
export const TEMPO_COPY = {
  mark: "Tempo",
  game: {
    rushed: "That part went fast. 🏃 Let's try a little game.",
    slow: "That part slowed down, with long pauses. 🐢 Let's try a little game.",
  },
  task: (topic: string) => `Tell me more about ${topic}, and keep the ball in the green.`,
  room: "🤫 Find a quiet spot first.",
  ready: "I'm ready",
  skip: "Skip",
  stop: "Stop",
  again: "Practise again",
  next: "Next",
  tryLabel: (n: number) => `Try ${n}`,
  scale: "The pace scale",
  blocked: "The microphone is blocked. Allow it for this site in the browser's settings, then try again.",
  comment: {
    ok: "Better. You let it breathe.",
    rush: "Still rushed. Take a breath after each offer.",
    slow: "A bit slow. Keep the words moving between the pauses.",
  } satisfies Record<TempoTry, string>,
  landed: "That landed. 🎯 Really better. Let's move on.",
  push: "You're close. 💪 Give it one more try.",
  close: {
    dynamic: "Dynamic. You paused where it mattered. 🔥",
    rush: "Still rushed. Give each offer its own breath next Take.",
    slow: "Slow. Keep the words moving between the pauses.",
  } satisfies Record<TempoClose, string>,
} as const;
