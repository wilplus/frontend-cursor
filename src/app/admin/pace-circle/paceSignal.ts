/* -------------------------------------------------------------------------- */
/*  The Pace Circle's three live reads (founder 2026-10-24; backend decisions  */
/*  log N130, N131; SPEC §17 pace-speed-v1, pace-pause-share-v1,              */
/*  pace-pause-length-v1). Pure: one loudness frame in (dB, every 10 ms),     */
/*  the reads out. No transcript, no network, nothing stored.                 */
/*                                                                            */
/*  - speed: syllables (peaks in the voice's loudness) per second of speech   */
/*    over the last ~5 s, pauses taken out;                                   */
/*  - share: the part of the last ~45 s that was silence, counting only gaps  */
/*    of 250 ms or longer;                                                    */
/*  - pauseMs: how long the current gap has run, 0 while speaking.            */
/*                                                                            */
/*  Silence is quieter than the room, measured in the first 2 s.              */
/* -------------------------------------------------------------------------- */

export const FRAME_MS = 10;

export type PaceConfig = {
  calibrateMs: number;
  minGapMs: number;
  speedWindowMs: number;
  shareWindowMs: number;
  /** A frame is voiced above floor + voiceMarginDb, and stays voiced until it
   *  drops under floor + silenceMarginDb (hysteresis, so a voice hovering on
   *  the line does not flicker). */
  voiceMarginDb: number;
  silenceMarginDb: number;
  /** A syllable is a loudness peak that rises and falls by this much. */
  peakProminenceDb: number;
  /** No two syllables closer than this (caps the count near 8 a second). */
  minPeakSpacingMs: number;
  /** Speed waits for this much speech in its window before it reads. */
  minSpeechForSpeedMs: number;
  /** Share waits for this much listening before it reads. */
  minListenForShareMs: number;
};

export const DEFAULT_CONFIG: PaceConfig = {
  calibrateMs: 2000,
  minGapMs: 250,
  speedWindowMs: 5000,
  shareWindowMs: 45000,
  voiceMarginDb: 10,
  silenceMarginDb: 6,
  peakProminenceDb: 3,
  minPeakSpacingMs: 120,
  minSpeechForSpeedMs: 1500,
  minListenForShareMs: 8000,
};

export type PaceRead = {
  calibrated: boolean;
  floorDb: number | null;
  voiced: boolean;
  /** Syllables per second of speech; null until there is enough speech. */
  speed: number | null;
  /** 0..1 of the window that was pause; null until enough listening. */
  share: number | null;
  /** Length of the gap happening now, once it is a pause (>= minGapMs). */
  pauseMs: number;
  /** Seconds of speech heard so far (pauses taken out). */
  speechSec: number;
};

const VOICED = 0;
const SHORT_GAP = 1; // silence too short to be a pause: part of speech
const PAUSE = 2;

export class PaceMeter {
  private cfg: PaceConfig;
  private calib: number[] = [];
  private floor: number | null = null;
  private voiced = false;
  private env: number | null = null;
  private frames: number[] = []; // VOICED | SHORT_GAP | PAUSE, newest last
  private gapRun = 0; // frames in the current silent run
  private peaks: number[] = []; // frame index of each syllable
  private index = 0; // frames since calibration ended
  private speechFrames = 0;
  // peak picking with hysteresis
  private seeking: "peak" | "valley" = "peak";
  private extreme = -Infinity;
  private extremeAt = 0;
  private extremeVoiced = false;

  constructor(cfg: Partial<PaceConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
  }

  push(db: number): PaceRead {
    const c = this.cfg;
    if (this.floor === null) {
      this.calib.push(db);
      if (this.calib.length * FRAME_MS >= c.calibrateMs) {
        const sorted = [...this.calib].sort((a, b) => a - b);
        this.floor = sorted[Math.floor(sorted.length / 2)];
      }
      return this.read();
    }

    // light smoothing (~20 ms) so one noisy frame is not a syllable
    this.env = this.env === null ? db : this.env + (db - this.env) * 0.5;
    const e = this.env;
    const floor = this.floor;
    this.voiced = this.voiced ? e > floor + c.silenceMarginDb : e > floor + c.voiceMarginDb;

    if (this.voiced) {
      this.frames.push(VOICED);
      this.gapRun = 0;
    } else {
      this.gapRun += 1;
      const isPause = this.gapRun * FRAME_MS >= c.minGapMs;
      this.frames.push(isPause ? PAUSE : SHORT_GAP);
      // the moment a gap becomes a pause, the whole run was pause
      if (isPause && (this.gapRun - 1) * FRAME_MS < c.minGapMs) {
        for (let i = 1; i < this.gapRun && i <= this.frames.length; i++) {
          this.frames[this.frames.length - i] = PAUSE;
        }
        this.speechFrames -= this.gapRun - 1;
      }
    }
    if (this.frames[this.frames.length - 1] !== PAUSE) this.speechFrames += 1;

    this.pickPeak(e, floor);
    this.index += 1;

    const keep = Math.ceil(c.shareWindowMs / FRAME_MS);
    if (this.frames.length > keep) this.frames.splice(0, this.frames.length - keep);
    const oldestPeak = this.index - Math.ceil(c.speedWindowMs / FRAME_MS);
    while (this.peaks.length && this.peaks[0] < oldestPeak) this.peaks.shift();

    return this.read();
  }

  private pickPeak(e: number, floor: number) {
    const c = this.cfg;
    if (this.seeking === "peak") {
      if (e > this.extreme) {
        this.extreme = e;
        this.extremeAt = this.index;
        this.extremeVoiced = e > floor + c.voiceMarginDb;
      } else if (e < this.extreme - c.peakProminenceDb) {
        const last = this.peaks[this.peaks.length - 1];
        const spaced = last === undefined || (this.extremeAt - last) * FRAME_MS >= c.minPeakSpacingMs;
        if (this.extremeVoiced && spaced) this.peaks.push(this.extremeAt);
        this.seeking = "valley";
        this.extreme = e;
      }
    } else if (e < this.extreme) {
      this.extreme = e;
    } else if (e > this.extreme + c.peakProminenceDb) {
      this.seeking = "peak";
      this.extreme = e;
      this.extremeAt = this.index;
      this.extremeVoiced = e > floor + c.voiceMarginDb;
    }
  }

  private read(): PaceRead {
    const c = this.cfg;
    if (this.floor === null) {
      return { calibrated: false, floorDb: null, voiced: false, speed: null, share: null, pauseMs: 0, speechSec: 0 };
    }
    const speedFrames = Math.ceil(c.speedWindowMs / FRAME_MS);
    const recent = this.frames.slice(-speedFrames);
    const speechMs = recent.filter((f) => f !== PAUSE).length * FRAME_MS;
    const speed = speechMs >= c.minSpeechForSpeedMs ? this.peaks.length / (speechMs / 1000) : null;
    const listenedMs = this.frames.length * FRAME_MS;
    const share =
      listenedMs >= c.minListenForShareMs
        ? this.frames.filter((f) => f === PAUSE).length / this.frames.length
        : null;
    const pauseMs = this.gapRun * FRAME_MS >= c.minGapMs ? this.gapRun * FRAME_MS : 0;
    return {
      calibrated: true,
      floorDb: this.floor,
      voiced: this.voiced,
      speed,
      share,
      pauseMs,
      speechSec: (Math.max(0, this.speechFrames) * FRAME_MS) / 1000,
    };
  }
}

/* ── From reads to the screen ─────────────────────────────────────────────── */

export type Centre = { speed: number; share: number };

/** Research starting centre (N131): the rate syllables are said while
 *  talking, about 5 a second in English; about a quarter of the time silent. */
export const RESEARCH_CENTRE: Centre = { speed: 5.0, share: 0.28 };
/** The personal centre never leaves this band (N130). */
export const HEALTHY_BAND = { speed: [4.0, 6.5] as const, share: [0.15, 0.45] as const };
/** How far from the centre reaches the circle's edge. */
export const REACH = { speed: 1.5, share: 0.2 };
const DEAD_ZONE = 0.08;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function shape(v: number): number {
  const c = clamp(v, -1, 1);
  if (Math.abs(c) < DEAD_ZONE) return 0;
  return Math.sign(c) * ((Math.abs(c) - DEAD_ZONE) / (1 - DEAD_ZONE));
}

/** Where the ball heads: x right = faster, y up = less silence. A read that
 *  is not ready yet leaves that axis where it was (`hold`). */
export function ballTarget(read: PaceRead, centre: Centre, hold: { x: number; y: number }) {
  const x = read.speed === null ? hold.x : shape((read.speed - centre.speed) / REACH.speed);
  const y = read.share === null ? hold.y : shape((centre.share - read.share) / REACH.share);
  return { x, y };
}

export type RimStops = { amberMs: number; deepMs: number };
export const RIM_STOPS: RimStops = { amberMs: 1200, deepMs: 2500 };

/** 0 = green, 1 = amber, 2 = deep amber, with blends between (never red). */
export function rimLevel(pauseMs: number, stops: RimStops = RIM_STOPS): number {
  const fade = 400;
  if (pauseMs <= stops.amberMs - fade) return 0;
  if (pauseMs < stops.amberMs) return 1 - (stops.amberMs - pauseMs) / fade;
  if (pauseMs <= stops.deepMs - fade) return 1;
  if (pauseMs < stops.deepMs) return 2 - (stops.deepMs - pauseMs) / fade;
  return 2;
}

/* ── The speaker's own baseline ───────────────────────────────────────────── */

export type Personal = { speechMinutes: number; speed: number; share: number };

/** Research first, sliding to the speaker's own: about half-way after 10
 *  minutes of speech, never more than 80% their own, and never outside the
 *  healthy band (N130). */
export function blendCentre(research: Centre, personal: Personal | null): { centre: Centre; weight: number } {
  if (!personal || personal.speechMinutes <= 0) return { centre: research, weight: 0 };
  const m = personal.speechMinutes;
  const weight = Math.min(0.8, m / (m + 10));
  const own = {
    speed: clamp(personal.speed, HEALTHY_BAND.speed[0], HEALTHY_BAND.speed[1]),
    share: clamp(personal.share, HEALTHY_BAND.share[0], HEALTHY_BAND.share[1]),
  };
  return {
    centre: {
      speed: research.speed * (1 - weight) + own.speed * weight,
      share: research.share * (1 - weight) + own.share * weight,
    },
    weight,
  };
}

/** Fold one session (its median speed, its share, its minutes of speech)
 *  into the speaker's running baseline, weighted by minutes of speech. */
export function foldSession(prev: Personal | null, session: Personal): Personal {
  if (session.speechMinutes <= 0) return prev ?? session;
  if (!prev || prev.speechMinutes <= 0) return session;
  const total = prev.speechMinutes + session.speechMinutes;
  return {
    speechMinutes: total,
    speed: (prev.speed * prev.speechMinutes + session.speed * session.speechMinutes) / total,
    share: (prev.share * prev.speechMinutes + session.share * session.speechMinutes) / total,
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
