/* -------------------------------------------------------------------------- */
/*  The tempo step — the pace scale as a step of the Feedback walk (backend  */
/*  N162, N166; the walk's page §2 "Tempo"; prototype Tempo in the Walk      */
/*  https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV).                       */
/*                                                                            */
/*  The stretch of the Take the speaker rushed or dragged is played back;     */
/*  they talk about it again while the scale follows them, up to three tries; */
/*  each try gets one comment, and the step ends with one line. Pure: what a  */
/*  try's path means, and which line closes the step. Words only, never a    */
/*  number (Never 1).                                                         */
/* -------------------------------------------------------------------------- */

import { zoneLevel } from "./pace/paceSignal";

/** The rings panel's row for the step (backend rings.TEMPO_STEP, N166 step
 *  6): whoever it reaches has the step, besides the founder. */
export const TEMPO_STEP_FEATURE = "tempo_step";

/** Up to three tries (N166 item 3). */
export const TEMPO_MAX_TRIES = 3;

/** The stretch the step practises: the one the scale reads furthest from
 *  the green (N166 item 1), what it was, and what it was about. */
export type TempoStretch = {
  reading: "rushed" | "slow";
  /** What the stretch was about, said back in Will's task line. */
  topic: string;
  /** The sentence around the stretch, the stretch itself marked. */
  said: { before: string; stretch: string; after: string };
};

/** One try, as the step reads it from the dot's path. */
export type TempoTry = "ok" | "rush" | "slow";

/** How the step closes. */
export type TempoClose = "dynamic" | "rush" | "slow";

/** What the step tells its host as it goes (N166 step 4): it opened, a try
 *  was read, or the game ended (each try's result and path, and how it
 *  ended; none when skipped before a try). The host writes the chat and
 *  keeps the game for Will. */
export type TempoEvent =
  | { kind: "opened" }
  | { kind: "try"; n: number; result: TempoTry }
  | { kind: "ended"; tries: { result: TempoTry; path: number[] }[]; close: TempoClose | null };

/** A try's path: the meter's activity, 0..1, sampled through the try.
 *  Mostly in the green: ok. Otherwise the side it spent longer on; too
 *  short to tell reads as slow. */
export function readTry(path: readonly number[]): TempoTry {
  if (path.length < 5) return "slow";
  const share = (keep: (v: number) => boolean) => path.filter(keep).length / path.length;
  if (share((v) => zoneLevel(v * 2 - 1) < 0.5) >= 0.5) return "ok";
  return share((v) => v > 0.75) >= share((v) => v < 0.25) ? "rush" : "slow";
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

/** The step's words, signed by the founder 2026-10-26 (backend N178; the
 *  walk's page §1 K). A change to any of them needs the founder's OK
 *  (Never 4). */
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
  finish: "See how it went",
  next: "Next",
  tryLabel: (n: number) => `Try ${n}`,
  scale: "The pace scale",
  blocked: "The microphone is blocked. Allow it for this site in the browser's settings, then try again.",
  comment: {
    ok: "Better. You let it breathe.",
    rush: "Still rushed. Take a breath after each offer.",
    slow: "A bit slow. Keep the words moving between the pauses.",
  } satisfies Record<TempoTry, string>,
  close: {
    dynamic: "Dynamic. You paused where it mattered. 🔥",
    rush: "Still rushed. Give each offer its own breath next Take.",
    slow: "Slow. Keep the words moving between the pauses.",
  } satisfies Record<TempoClose, string>,
} as const;
