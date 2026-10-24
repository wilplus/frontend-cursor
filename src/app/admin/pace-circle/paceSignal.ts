/* -------------------------------------------------------------------------- */
/*  The Pace Circle's three live reads (founder 2026-10-24; backend decisions  */
/*  log N130, N133, N134; SPEC §17 pace-speed-v2, pace-pause-share-v2,        */
/*  pace-pause-length-v1). Pure: one loudness frame in (dB, every 10 ms),     */
/*  the reads out. No transcript, no network, nothing stored.                 */
/*                                                                            */
/*  - speed: syllables (peaks in the voice's loudness) per second of speech,  */
/*    a running average over about the last 1.5 s of speech, pauses taken out;  */
/*  - share: how much of about the last 8 s was silence, as a running         */
/*    average, counting only gaps of 250 ms or longer;                        */
/*  - pauseMs: how long the current gap has run, 0 while speaking.            */
/*                                                                            */
/*  Both averages move a little on every syllable and every 10 ms of pause,   */
/*  so the ball moves as the speaker speaks (N134: "it moves slowly but it   */
/*  constantly moves"). Silence is quieter than the room, measured in the     */
/*  first 2 s.                                                                */
/* -------------------------------------------------------------------------- */

export const FRAME_MS = 10;

export type PaceConfig = {
  calibrateMs: number;
  minGapMs: number;
  /** Time constant of the speed average, in milliseconds of speech. */
  speedTauMs: number;
  /** Time constant of the pause-share average, in milliseconds. */
  shareTauMs: number;
  /** Where the share average starts, so the ball starts near the centre. */
  shareStart: number;
  /** A frame is voiced above floor + voiceMarginDb, and stays voiced until it
   *  drops under floor + silenceMarginDb (hysteresis, so a voice hovering on
   *  the line does not flicker). */
  voiceMarginDb: number;
  silenceMarginDb: number;
  /** A syllable is a loudness peak that rises and falls by this much. */
  peakProminenceDb: number;
  /** No two syllables closer than this (caps the count near 8 a second). */
  minPeakSpacingMs: number;
  /** Sound must stay above the voice line this long before it counts as
   *  voice, so a click or a cough in the room does not (0 = at once). */
  minVoiceMs: number;
  /** Speed waits for this much speech before its first read. */
  minSpeechForSpeedMs: number;
  /** Share waits for this much listening before its first read. */
  minListenForShareMs: number;
};

export const DEFAULT_CONFIG: PaceConfig = {
  calibrateMs: 2000,
  minGapMs: 250,
  speedTauMs: 1500,
  shareTauMs: 8000,
  shareStart: 0.28,
  voiceMarginDb: 10,
  silenceMarginDb: 6,
  peakProminenceDb: 3,
  minPeakSpacingMs: 120,
  minVoiceMs: 0,
  minSpeechForSpeedMs: 600,
  minListenForShareMs: 1000,
};

export type PaceRead = {
  calibrated: boolean;
  floorDb: number | null;
  voiced: boolean;
  /** Syllables per second of speech; null until there is enough speech. */
  speed: number | null;
  /** 0..1 of the recent time that was pause; null until enough listening. */
  share: number | null;
  /** Length of the gap happening now, once it is a pause (>= minGapMs). */
  pauseMs: number;
  /** Seconds of speech heard so far (pauses taken out). */
  speechSec: number;
  /** Estimated words per minute over the last 10 s, 30 s and 60 s of
   *  listening, pauses included (syllables ÷ SYLLABLES_PER_WORD); null until
   *  3 s have been heard. A window not yet full uses what has been heard. */
  wpm10: number | null;
  wpm30: number | null;
  wpm60: number | null;
};

/** English averages about 1.5 syllables a word. */
export const SYLLABLES_PER_WORD = 1.5;
const WPM_WINDOWS_MS = [10000, 30000, 60000] as const;
const WPM_MIN_MS = 3000;

export class PaceMeter {
  private cfg: PaceConfig;
  private calib: number[] = [];
  private floor: number | null = null;
  private voiced = false;
  private env: number | null = null;
  private gapRun = 0; // frames in the current silent run
  private loudRun = 0; // frames in a row above the voice line
  private index = 0; // frames since calibration ended
  private speechFrames = 0;
  private lastPeak: number | null = null;
  private peakTimes: number[] = []; // frame index of every syllable in the last 60 s
  // running averages
  private syll = 0; // decayed syllable count
  private speechW = 0; // decayed seconds of speech
  private share: number;
  private readonly speedKeep: number;
  private readonly shareKeep: number;
  // peak picking with hysteresis
  private seeking: "peak" | "valley" = "peak";
  private extreme = -Infinity;
  private extremeAt = 0;
  private extremeVoiced = false;

  constructor(cfg: Partial<PaceConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.share = this.cfg.shareStart;
    this.speedKeep = Math.exp(-FRAME_MS / this.cfg.speedTauMs);
    this.shareKeep = Math.exp(-FRAME_MS / this.cfg.shareTauMs);
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
    this.loudRun = e > floor + c.voiceMarginDb ? this.loudRun + 1 : 0;
    this.voiced = this.voiced
      ? e > floor + c.silenceMarginDb
      : this.loudRun * FRAME_MS >= Math.max(FRAME_MS, c.minVoiceMs);

    let pause = false;
    if (this.voiced) {
      this.gapRun = 0;
    } else {
      this.gapRun += 1;
      pause = this.gapRun * FRAME_MS >= c.minGapMs;
      // The moment a gap becomes a pause, the whole run was pause: take its
      // earlier frames back out of speech and put them into the share.
      if (pause && (this.gapRun - 1) * FRAME_MS < c.minGapMs) {
        const back = this.gapRun - 1;
        this.speechFrames -= back;
        this.speechW = Math.max(0, this.speechW - (back * FRAME_MS) / 1000);
        this.share += (1 - this.share) * (1 - Math.pow(this.shareKeep, back));
      }
    }

    if (!pause) {
      // speech (voiced, or a gap too short to be a pause): speed averages on
      this.speechFrames += 1;
      this.syll *= this.speedKeep;
      this.speechW = this.speechW * this.speedKeep + FRAME_MS / 1000;
    }
    this.share = this.share * this.shareKeep + (pause ? 1 - this.shareKeep : 0);

    this.pickPeak(e, floor);
    this.index += 1;
    const oldest = this.index - WPM_WINDOWS_MS[WPM_WINDOWS_MS.length - 1] / FRAME_MS;
    while (this.peakTimes.length && this.peakTimes[0] < oldest) this.peakTimes.shift();
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
        const spaced = this.lastPeak === null || (this.extremeAt - this.lastPeak) * FRAME_MS >= c.minPeakSpacingMs;
        if (this.extremeVoiced && spaced) {
          this.lastPeak = this.extremeAt;
          this.syll += 1;
          this.peakTimes.push(this.extremeAt);
        }
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
      return {
        calibrated: false, floorDb: null, voiced: false, speed: null, share: null, pauseMs: 0, speechSec: 0,
        wpm10: null, wpm30: null, wpm60: null,
      };
    }
    const speechMs = Math.max(0, this.speechFrames) * FRAME_MS;
    const speed = speechMs >= c.minSpeechForSpeedMs && this.speechW > 0 ? this.syll / this.speechW : null;
    const share = this.index * FRAME_MS >= c.minListenForShareMs ? this.share : null;
    const pauseMs = this.gapRun * FRAME_MS >= c.minGapMs ? this.gapRun * FRAME_MS : 0;
    return {
      calibrated: true,
      floorDb: this.floor,
      voiced: this.voiced,
      speed,
      share,
      pauseMs,
      speechSec: speechMs / 1000,
      wpm10: this.wpm(WPM_WINDOWS_MS[0]),
      wpm30: this.wpm(WPM_WINDOWS_MS[1]),
      wpm60: this.wpm(WPM_WINDOWS_MS[2]),
    };
  }

  private wpm(windowMs: number): number | null {
    const heardMs = Math.min(windowMs, this.index * FRAME_MS);
    if (heardMs < WPM_MIN_MS) return null;
    const from = this.index - heardMs / FRAME_MS;
    let n = 0;
    for (let i = this.peakTimes.length - 1; i >= 0 && this.peakTimes[i] >= from; i--) n++;
    return (n / SYLLABLES_PER_WORD) * (60000 / heardMs);
  }
}

/* ── The pace scale (founder 2026-10-24) ──────────────────────────────────── */

/** The healthy band, in words per minute, and where the scale's ends sit.
 *  Wide on purpose, so many speaking styles sit inside it. */
export type WpmBand = { low: number; high: number; floor: number; ceiling: number };
export const WPM_BAND: WpmBand = { low: 110, high: 175, floor: 70, ceiling: 220 };
/** The healthy zone fills the middle of the scale, from -ZONE to +ZONE. */
export const ZONE = 0.4;

/** How far one window is outside the band: 0 inside, up to ±1 at an end. */
function outside(v: number | null, b: WpmBand): number {
  if (v === null) return 0;
  if (v > b.high) return Math.min(1, (v - b.high) / (b.ceiling - b.high));
  if (v < b.low) return -Math.min(1, (b.low - v) / (b.low - b.floor));
  return 0;
}

/** Where the dot heads on the scale (-1 left .. +1 right). If words per
 *  minute over 10 s, 30 s or 60 s is above the band it goes right, below it
 *  goes left, by the window furthest out. Inside the band it drifts gently
 *  inside the healthy zone with the live speed, so it moves as you speak. */
export function scaleTarget(read: PaceRead, band: WpmBand, liveCentre: number, hold: number): number {
  if (read.wpm10 === null) return hold;
  const outs = [read.wpm10, read.wpm30, read.wpm60].map((v) => outside(v, band));
  const worst = outs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  if (worst !== 0) return Math.sign(worst) * (ZONE + (1 - ZONE) * Math.abs(worst));
  const mid = (band.low + band.high) / 2;
  const inBand = (read.wpm10 - mid) / ((band.high - band.low) / 2); // -1..1 across the band
  const live = read.speed === null ? 0 : (read.speed - liveCentre) / REACH.speed;
  return clamp(0.6 * inBand + 0.4 * live, -1, 1) * ZONE * 0.95;
}

/* ── From reads to the screen ─────────────────────────────────────────────── */

export type Centre = { speed: number; share: number };

/** Research starting centre (N133): the rate syllables are said while
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

/** 0 = green, 1 = orange, 2 = red, with blends between (founder 2026-10-24). */
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

/* ── The silence scale (founder 2026-10-24) ────────────────────────────────── */

/** The one signal: how much of the recent time was silence. Before anyone
 *  speaks it is all silence, an endless pause: the dot rests at the far
 *  left, red. Speaking moves it right through orange into the green middle;
 *  speaking with almost no pauses carries it on to the right edge. */
export type SilenceStops = {
  /** Share of silence below which it is rushing (red at the right edge). */
  redLow: number;
  /** The green middle runs between these shares of silence. */
  greenLow: number;
  greenHigh: number;
  /** Share of silence above which it is one long pause (red at the left). */
  redHigh: number;
};
export const SILENCE_STOPS: SilenceStops = { redLow: 0.05, greenLow: 0.15, greenHigh: 0.45, redHigh: 0.7 };

/** The meter settings for the silence scale: a running share over about
 *  6 s that starts as all silence, and voice only when clearly louder than
 *  the room for 80 ms. */
export const SILENCE_METER: Partial<PaceConfig> = {
  shareTauMs: 6000,
  shareStart: 1,
  minListenForShareMs: 0,
  voiceMarginDb: 14,
  silenceMarginDb: 8,
  minVoiceMs: 80,
};

/** Where the dot heads (-1 left .. +1 right) for a share of silence. The
 *  green middle covers -0.5..+0.5, orange runs on to ±0.9, red is the last
 *  tenth at each end. */
export function silenceTarget(share: number, s: SilenceStops = SILENCE_STOPS): number {
  const mid = (s.greenLow + s.greenHigh) / 2;
  const points: [number, number][] = [
    [0, 1], [s.redLow, 0.9], [s.greenLow, 0.5], [mid, 0], [s.greenHigh, -0.5], [s.redHigh, -0.9], [1, -1],
  ];
  const v = clamp(share, 0, 1);
  for (let i = 1; i < points.length; i++) {
    const [a, xa] = points[i - 1];
    const [b, xb] = points[i];
    if (v <= b) return b === a ? xb : xa + ((v - a) / (b - a)) * (xb - xa);
  }
  return -1;
}

/** 0 = green, 1 = orange, 2 = red, by how far the dot is from the middle:
 *  green in the middle half, orange towards the ends, red only at the very
 *  edges, with short blends between. */
export function zoneLevel(x: number): number {
  const d = Math.abs(x);
  if (d <= 0.45) return 0;
  if (d < 0.55) return (d - 0.45) / 0.1;
  if (d <= 0.85) return 1;
  if (d < 0.92) return 1 + (d - 0.85) / 0.07;
  return 2;
}

/* ── The live scale: no windows, no delay (founder 2026-10-24) ─────────────── */

/** What can be known at once, every 10 ms: is the voice on, how long has the
 *  speaker been talking since the last pause, and how long has the current
 *  pause run. No average, so nothing waits. */
export type InstantRead = {
  voiced: boolean;
  /** Talking since the last pause (gaps under minGapMs are part of it). */
  runMs: number;
  /** The pause happening now (0 while talking). */
  pauseMs: number;
  floorDb: number;
  db: number;
  /** 0..1: how much of the last moment (about activityTauMs) had voice in
   *  it, updated every 10 ms. 0 in silence, 1 talking with no gaps. */
  activity: number;
};

export type InstantConfig = {
  /** Voice is this far over the room, for voiceOnMs, to turn on... */
  voiceMarginDb: number;
  voiceOnMs: number;
  /** ...and stays on until it falls under the room plus this. */
  silenceMarginDb: number;
  /** A gap shorter than this is between words, not a pause. */
  minGapMs: number;
  /** Time constant of `activity`: how fast the dot follows the voice. */
  activityTauMs: number;
  /** A sound counts as voice only this voice-like (0..1, see periodicity):
   *  a voice has pitch, a breath, a click or a rustle does not. */
  minPeriodicity: number;
  /** In silence the dot falls at a steady speed, slowly: from 1 to 0.5 in
   *  fallUpperMs, from 0.5 to 0 in fallLowerMs (founder 2026-10-24). */
  fallUpperMs: number;
  fallLowerMs: number;
  /** While speaking the dot first jumps from 0 to the middle (0.5) in
   *  riseJumpMs of voice, then climbs gently from 0.5 to 0.65 in riseBaseMs,
   *  then riseMidBoost times faster to 0.75 and riseTopBoost times faster to
   *  1: fluent speech with too few pauses speeds up towards the end
   *  (founder 2026-10-24). */
  riseJumpMs: number;
  riseBaseMs: number;
  riseMidBoost: number;
  riseTopBoost: number;
};
export const INSTANT_CONFIG: InstantConfig = {
  voiceMarginDb: 9,
  voiceOnMs: 30,
  silenceMarginDb: 4,
  minGapMs: 250,
  activityTauMs: 300,
  minPeriodicity: 0.4,
  fallUpperMs: 2600, // doubled after the founder's first try (2026-10-24)
  fallLowerMs: 5000,
  riseJumpMs: 400,
  riseBaseMs: 1500,
  riseMidBoost: 1.25,
  riseTopBoost: 1.37,
};

/** How voice-like a stretch of sound is, 0..1: the best normalised
 *  autocorrelation over the lags of a speaking voice's pitch (80-400 Hz).
 *  Voiced speech repeats itself and scores high (0.7 and up); a breath,
 *  hiss, a click or a rustle is random and scores low (under 0.4). */
export function periodicity(x: Float32Array, sampleRate: number): number {
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.ceil(sampleRate / 80);
  const n = x.length - maxLag;
  if (n <= minLag) return 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i];
      const b = x[i + lag];
      xy += a * b;
      xx += a * a;
      yy += b * b;
    }
    const r = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
    if (r > best) best = r;
  }
  return best;
}

export class InstantMeter {
  /** Settings may be changed while listening (the tuning sliders). */
  cfg: InstantConfig;
  private activity = 0;
  private floor: number | null = null;
  private voiced = false;
  private loudRun = 0;
  // Before anyone speaks it is one long pause.
  private gapRun = 100000;
  private runMs = 0;
  // The quietest level of the last 3 s, from a ring of 10 ms frames.
  private recent = new Float32Array(300).fill(Infinity);
  private at = 0;
  private frames = 0;

  constructor(cfg: Partial<InstantConfig> = {}) {
    this.cfg = { ...INSTANT_CONFIG, ...cfg };
  }

  push(db: number, voiceLike = 1): InstantRead {
    const c = this.cfg;
    this.frames += 1;
    // A microphone's first moments are often pure digital zeros, far quieter
    // than any real room. Taking that as the room made the real room look
    // like a voice, so the dot jumped to 1 at Start (founder 2026-10-24).
    // Such frames are silence and never the room.
    if (!Number.isFinite(db) || db < -100) return this.silent(db);
    // The room is the quietest moment of the last 3 s, always. Speech has
    // dips between words, so a voice still stands out; steady noise (a fan,
    // traffic, a microphone settling) has none, so within a couple of
    // seconds it becomes the room and reads as silence. Before, the room was
    // learned only while nobody spoke, so a louder room could read as a
    // voice that never stopped and push the dot to 1 (founder 2026-10-24).
    this.recent[this.at] = db;
    this.at = (this.at + 1) % this.recent.length;
    let quietest = Infinity;
    for (let i = 0; i < this.recent.length; i++) if (this.recent[i] < quietest) quietest = this.recent[i];
    if (this.floor === null) this.floor = db;
    else if (quietest < this.floor) this.floor += (quietest - this.floor) * 0.3;
    else this.floor = Math.min(quietest, this.floor + 0.1); // rises up to 10 dB a second
    const floor = this.floor;

    // The first 0.3 s after Start never counts as voice (the microphone's click).
    if (this.frames <= 30) return this.silent(db);
    // Voice is loud enough AND has pitch; it stays on while it is still
    // somewhat loud and somewhat pitched (a breath is neither for long).
    const pitched = voiceLike >= c.minPeriodicity;
    this.loudRun = db > floor + c.voiceMarginDb && pitched ? this.loudRun + 1 : 0;
    this.voiced = this.voiced
      ? db > floor + c.silenceMarginDb && voiceLike >= c.minPeriodicity - 0.2
      : this.loudRun * FRAME_MS >= c.voiceOnMs;

    if (this.voiced) this.gapRun = 0;
    else this.gapRun = Math.min(this.gapRun + 1, 100000);
    const pause = this.gapRun * FRAME_MS >= c.minGapMs;
    if (pause) this.runMs = 0;
    else this.runMs += FRAME_MS;

    return this.out(this.voiced, pause, floor, db);
  }

  private out(voiced: boolean, pause: boolean, floor: number, db: number): InstantRead {
    const c = this.cfg;
    if (voiced) {
      // Speaking: jump to the middle, climb gently to 0.65, then faster,
      // then faster still (speeds per ms).
      const gentle = 0.15 / Math.max(FRAME_MS, c.riseBaseMs);
      const speed =
        this.activity < 0.5
          ? 0.5 / Math.max(FRAME_MS, c.riseJumpMs)
          : this.activity < 0.65
            ? gentle
            : this.activity < 0.75
              ? gentle * c.riseMidBoost
              : gentle * c.riseTopBoost;
      this.activity = Math.min(1, this.activity + speed * FRAME_MS);
    } else if (!pause) {
      // A gap between words (under minGapMs) is still speech: hold.
    } else {
      // Silence: fall slowly and steadily, slower still below 0.5, so a
      // breath or a gap between words only nudges it and only a real pause
      // brings it to 0 (founder 2026-10-24).
      const span = this.activity > 0.5 ? c.fallUpperMs : c.fallLowerMs;
      this.activity = Math.max(0, this.activity - (0.5 * FRAME_MS) / Math.max(FRAME_MS, span));
    }
    return {
      voiced,
      runMs: this.runMs,
      pauseMs: pause ? this.gapRun * FRAME_MS : 0,
      floorDb: floor,
      db,
      activity: this.activity,
    };
  }

  /** A frame that is silence whatever its level. */
  private silent(db: number): InstantRead {
    this.voiced = false;
    this.loudRun = 0;
    this.gapRun = Math.min(this.gapRun + 1, 100000);
    const pause = this.gapRun * FRAME_MS >= this.cfg.minGapMs;
    if (pause) this.runMs = 0;
    else this.runMs += FRAME_MS;
    return this.out(false, pause, this.floor ?? db, db);
  }
}

/** Where talking and pausing take the dot. Talking pushes it right, the
 *  longer without a breath the further; a pause pulls it left, the longer
 *  the further. Green to ±0.5, orange to ±0.9, red at the ends. */
export type InstantStops = { greenRunMs: number; redRunMs: number; greenPauseMs: number; redPauseMs: number };
export const INSTANT_STOPS: InstantStops = { greenRunMs: 4000, redRunMs: 9000, greenPauseMs: 1000, redPauseMs: 2500 };

function ramp(v: number, green: number, red: number): number {
  if (v <= green) return (v / green) * 0.5;
  if (v <= red) return 0.5 + ((v - green) / (red - green)) * 0.4;
  return Math.min(1, 0.9 + ((v - red) / red) * 0.1);
}

export function instantTarget(read: InstantRead, s: InstantStops = INSTANT_STOPS): number {
  if (read.pauseMs > 0) return -ramp(read.pauseMs, s.greenPauseMs, s.redPauseMs);
  return ramp(read.runMs, s.greenRunMs, s.redRunMs);
}
