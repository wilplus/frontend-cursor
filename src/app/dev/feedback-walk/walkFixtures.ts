import type { WalkScreen } from "@/lib/willab/walkMotion";
import { CHUNK_SHEET_COPY as COPY, WALK_LINE_BANK } from "@/components/willab/idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  Fixtures for the Feedback walk harness (/dev/feedback-walk). DEV ONLY.     */
/*                                                                            */
/*  The talk, the coach's lines and the moments are SAMPLE CONTENT — what a    */
/*  speaker would say and a coach would write — taken from the locked          */
/*  prototype. They are data, not product copy. Product words come from       */
/*  CHUNK_SHEET_COPY, WALK_COPY and the signed line bank (WALK_LINE_BANK)      */
/*  only. The one word still unsigned (the "Journal" eyebrow) is on no       */
/*  screen of this phase, so nothing here stands in for it.                   */
/* -------------------------------------------------------------------------- */

/** The signed line-bank line (N54) each harness screen shows: one per
 *  screen, as the founder asked for the fixtures. */
export const BANK_PICKS = {
  /** A try the machine heard improve: B07 (the ending went down). */
  improved: WALK_LINE_BANK.B07.lines[2],
} as const;

export const PROJECT_TITLE = "Q3 Board pitch";
export const SLIDE_LABEL = "Slide 2";
export const TAKE_SHOWN = 2;

export const PARAGRAPHS = [
  "Last quarter our growth doubled, and it came from two markets we entered in spring.",
  "We think the timing matters, because the window closes once the incumbents catch up with pricing.",
  "So today I'm asking for approval on the hiring plan.",
  "Two hires by March keep that lead.",
] as const;

export const COACH_NOTE =
  "You opened with the numbers, which is exactly right. Now let the pause after “doubled” breathe. It’s the moment the board decides to lean in.";

/** One piece of the speaker's words: `cut` is crossed out, `fresh` is new. */
export type Piece = { text: string; cut?: boolean; fresh?: boolean };

export type Moment = {
  index: number;
  durationMs: number;
  /** A praise, and who sent it (the coach's line, or a signed app line). */
  praise?: { text: string; byCoach: boolean };
  clearer?: { before: Piece[]; after: Piece[]; say: string; coachLine: string };
  exercise?: { instruction: string };
};

export const MOMENTS: readonly Moment[] = [
  {
    index: 0,
    durationMs: 9000,
    praise: {
      text: "You opened with the number and let it sit. That is the board leaning in. Keep that pause.",
      byCoach: true,
    },
  },
  {
    index: 1,
    durationMs: 11000,
    clearer: {
      before: [
        { text: "We think the timing matters, because the", cut: true },
        { text: " window closes once the incumbents " },
        { text: "catch up with pricing", cut: true },
        { text: "." },
      ],
      after: [
        { text: "The", fresh: true },
        { text: " window closes once the incumbents " },
        { text: "match our price", fresh: true },
        { text: "." },
      ],
      say: "The window closes once the incumbents match our price.",
      coachLine: "Say it this way, and let “price” land at the end.",
    },
  },
  // The signed tentative praise (CHUNK_SHEET_COPY.praiseTentative), sent by the app.
  { index: 2, durationMs: 5000, praise: { text: COPY.praiseTentative, byCoach: false } },
  {
    index: 3,
    durationMs: 4000,
    exercise: { instruction: "Slow down on “March”, then let the sentence end low." },
  },
];

export const SCREEN_NAMES = [
  "coachnote",
  "praise",
  "clearer",
  "exVideo",
  "practise",
  "processing",
  "improved",
  "encourage",
  "helpers",
  "intro",
  "judge",
  "community",
  "end",
] as const;

export type ScreenName = (typeof SCREEN_NAMES)[number];
export type StepKey = ScreenName | "page";
export type Step = WalkScreen & { key: StepKey };

export const PAGE: Step = { key: "page", overlay: false };

/** ?screen=<name>: each screen on its own, from the prototype's moments. */
export const SINGLE: Record<ScreenName, Step> = {
  coachnote: { key: "coachnote" },
  praise: { key: "praise", moment: 0 },
  clearer: { key: "clearer", moment: 1 },
  exVideo: { key: "exVideo", moment: 3 },
  practise: { key: "practise", moment: 1, kind: "words" },
  processing: { key: "processing", moment: 1 },
  improved: { key: "improved", moment: 3 },
  encourage: { key: "encourage", moment: 1 },
  helpers: { key: "helpers", moment: 0 },
  intro: { key: "intro" },
  judge: { key: "judge", moment: 0 },
  community: { key: "community" },
  end: { key: "end", overlay: false },
};

/** ?flow=1: the locked order — the coach's note, all praise (each followed by
 *  its helper words), then the practising, "Judgement time!", the
 *  judgements, sharing, the end. */
export const FLOW: readonly Step[] = [
  PAGE,
  { key: "coachnote" },
  { key: "praise", moment: 0 },
  { key: "helpers", moment: 0 },
  { key: "praise", moment: 2 },
  { key: "helpers", moment: 2 },
  { key: "clearer", moment: 1 },
  { key: "practise", moment: 1, kind: "words" },
  { key: "processing", moment: 1 },
  { key: "encourage", moment: 1 },
  { key: "exVideo", moment: 3 },
  { key: "practise", moment: 3, kind: "instruction" },
  { key: "processing", moment: 3 },
  { key: "improved", moment: 3 },
  { key: "helpers", moment: 3 },
  { key: "intro" },
  { key: "judge", moment: 0 },
  { key: "judge", moment: 1 },
  { key: "judge", moment: 2 },
  { key: "judge", moment: 3 },
  { key: "community" },
  { key: "end", overlay: false },
];

/** A short, quiet tone as a WAV blob, so the harness player can play
 *  without a backend. */
export function makeToneUrl(seconds = 2.4): string {
  const rate = 8000;
  const n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const env = Math.sin((Math.PI * i) / n);
    v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 220 * t) * env * 2000), true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Signed words the page around the walk uses that are not in the copy
 *  files yet: "Review feedback" (journey question 1) and "Record Take N"
 *  (founder 2026-10-05, N48.3 Q8). IdealTextActions draws them inline. */
export const PAGE_WORDS = {
  reviewFeedback: "Review feedback",
  recordTake: (n: number) => `Record Take ${n}`,
} as const;
