/*
STORY    As the founder, I want the Pace Circle's ball and rim to follow my
         voice as the three signed definitions say, so that tuning it on a
         real voice tunes the right thing.
OUTCOME
  O1  Speed counts syllables per second of speech, with pauses left out.
  O2  Only gaps of a quarter second or longer count as pause.
  O3  The rim goes green, amber, deep amber, and never further.
  O4  The ball goes right when fast, left when slow, up with few pauses,
      down with many, and holds an axis that is not ready yet.
  O5  The centre moves to the speaker's own rhythm gradually, at most 80%,
      inside the healthy band (N130).
PROVES   O1 -> "counts syllables per second of speech", "leaves pauses out, so a pause does not make the speaker slower"
         O2 -> "counts only gaps of a quarter second or longer"
         O3 -> "turns the rim green, amber, deep amber and never further"
         O4 -> "goes right when fast, left when slow, up with no pauses, down with many", "holds an axis that is not ready yet"
         O5 -> "moves to the speaker's own rhythm gradually, at most 80%, inside the healthy band"
WHY      CONSTRUCT fence: SPEC §17 pace-speed-v1, pace-pause-share-v1 and
         pace-pause-length-v1 each move one thing on the screen (N133).
*/
import { describe, expect, it } from "vitest";
import {
  FRAME_MS,
  PaceMeter,
  RESEARCH_CENTRE,
  ballTarget,
  blendCentre,
  foldSession,
  rimLevel,
  type PaceRead,
} from "./paceSignal";

const FLOOR = -60;

/** Feed `ms` of a room at the floor. */
function quiet(m: PaceMeter, ms: number): PaceRead {
  let r!: PaceRead;
  for (let t = 0; t < ms; t += FRAME_MS) r = m.push(FLOOR);
  return r;
}

/** Feed `ms` of speech at `rate` syllables a second: loudness bumps between
 *  20 and 35 dB over the floor. */
function talk(m: PaceMeter, ms: number, rate: number): PaceRead {
  let r!: PaceRead;
  const period = 1000 / rate;
  for (let t = 0; t < ms; t += FRAME_MS) {
    const phase = (t % period) / period;
    r = m.push(FLOOR + 27.5 + 7.5 * Math.cos(phase * 2 * Math.PI));
  }
  return r;
}

function calibrated() {
  const m = new PaceMeter();
  quiet(m, 2000);
  return m;
}

describe("speaking speed (pace-speed-v1)", () => {
  it("counts syllables per second of speech", () => {
    const m = calibrated();
    const r = talk(m, 6000, 5);
    expect(r.speed).not.toBeNull();
    expect(r.speed!).toBeGreaterThan(4.4);
    expect(r.speed!).toBeLessThan(5.6);
  });

  it("tells fast from slow", () => {
    const fast = talk(calibrated(), 6000, 6.5).speed!;
    const slow = talk(calibrated(), 6000, 3).speed!;
    expect(fast).toBeGreaterThan(slow + 2);
  });

  it("leaves pauses out, so a pause does not make the speaker slower", () => {
    const m = calibrated();
    talk(m, 2000, 5);
    quiet(m, 1000);
    const r = talk(m, 2000, 5);
    expect(r.speed!).toBeGreaterThan(4.4);
  });

  it("waits for enough speech before it reads", () => {
    const r = talk(calibrated(), 800, 5);
    expect(r.speed).toBeNull();
  });
});

describe("how much of the time you pause (pace-pause-share-v1)", () => {
  it("counts only gaps of a quarter second or longer", () => {
    const m = calibrated();
    let r!: PaceRead;
    // 10 s of speech with 150 ms gaps: not pauses
    for (let i = 0; i < 20; i++) {
      talk(m, 350, 5);
      r = quiet(m, 150);
    }
    expect(r.share).not.toBeNull();
    expect(r.share!).toBeLessThan(0.05);
  });

  it("reads more silence as a larger share", () => {
    const m = calibrated();
    let r!: PaceRead;
    for (let i = 0; i < 10; i++) {
      talk(m, 600, 5);
      r = quiet(m, 600);
    }
    expect(r.share!).toBeGreaterThan(0.4);
    expect(r.share!).toBeLessThan(0.6);
  });
});

describe("the pause happening now (pace-pause-length-v1)", () => {
  it("is zero while speaking and grows during a pause", () => {
    const m = calibrated();
    expect(talk(m, 1000, 5).pauseMs).toBe(0);
    expect(quiet(m, 200).pauseMs).toBe(0); // not a pause yet
    expect(quiet(m, 1800).pauseMs).toBeGreaterThanOrEqual(1900);
  });

  it("turns the rim green, amber, deep amber and never further", () => {
    expect(rimLevel(300)).toBe(0);
    expect(rimLevel(1500)).toBe(1);
    expect(rimLevel(4000)).toBe(2);
    expect(rimLevel(60000)).toBe(2);
  });
});

describe("the ball and the centre", () => {
  const read = (speed: number | null, share: number | null): PaceRead => ({
    calibrated: true, floorDb: FLOOR, voiced: true, speed, share, pauseMs: 0, speechSec: 10,
  });

  it("goes right when fast, left when slow, up with no pauses, down with many", () => {
    const hold = { x: 0, y: 0 };
    expect(ballTarget(read(6.5, 0.28), RESEARCH_CENTRE, hold).x).toBeGreaterThan(0.5);
    expect(ballTarget(read(3.5, 0.28), RESEARCH_CENTRE, hold).x).toBeLessThan(-0.5);
    expect(ballTarget(read(5, 0.05), RESEARCH_CENTRE, hold).y).toBeGreaterThan(0.5);
    expect(ballTarget(read(5, 0.5), RESEARCH_CENTRE, hold).y).toBeLessThan(-0.5);
  });

  it("holds an axis that is not ready yet", () => {
    expect(ballTarget(read(null, null), RESEARCH_CENTRE, { x: 0.3, y: -0.2 })).toEqual({ x: 0.3, y: -0.2 });
  });

  it("moves to the speaker's own rhythm gradually, at most 80%, inside the healthy band", () => {
    expect(blendCentre(RESEARCH_CENTRE, null).weight).toBe(0);
    const half = blendCentre(RESEARCH_CENTRE, { speechMinutes: 10, speed: 6, share: 0.3 });
    expect(half.weight).toBeCloseTo(0.5);
    expect(half.centre.speed).toBeCloseTo(5.5);
    const long = blendCentre(RESEARCH_CENTRE, { speechMinutes: 500, speed: 9, share: 0.9 });
    expect(long.weight).toBe(0.8);
    expect(long.centre.speed).toBeLessThanOrEqual(6.5);
    expect(long.centre.share).toBeLessThanOrEqual(0.45);
  });

  it("folds sessions in by minutes of speech", () => {
    const a = foldSession(null, { speechMinutes: 2, speed: 4, share: 0.2 });
    const b = foldSession(a, { speechMinutes: 2, speed: 6, share: 0.4 });
    expect(b.speechMinutes).toBe(4);
    expect(b.speed).toBeCloseTo(5);
    expect(b.share).toBeCloseTo(0.3);
  });
});
