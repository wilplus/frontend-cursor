/* The speaking coach, assembled from the signed lines and the try caps
   the walk already uses. A second hand-written copy of those lines would
   drift; this function reads them. */

import { ONE_THING_COPY } from "@/components/willab/idealEditCopy";
import { PROCESSING_STAGES } from "@/components/willab/ProcessingWait";
import { ONE_THING_TRIES, WALK_MAX_TRIES } from "@/lib/willab/walkPlan";
import { TEMPO_COPY, LAND_GREEN_SHARE } from "@/lib/willab/tempoStep";
import type { CoachDefinition, WalkStepDef } from "./types";

/** Backend noticing_settings.DEFAULTS for the dials a coach may hold.
    Rank and pinned values that are not listed here stay in code. */
export const NOTICING_DIALS: { name: string; default: number }[] = [
  { name: "tempo_stretch.MIN_OUTSIDE", default: 0.25 },
  { name: "verbal_cues.FILLER_MIN_COUNT", default: 2 },
  { name: "verbal_cues.FILLER_MIN_PER_100_WORDS", default: 5 },
  { name: "verbal_cues.HEDGE_MIN_COUNT", default: 2 },
  { name: "verbal_cues.RESTART_MIN_COUNT", default: 2 },
  { name: "rewrite_gate.REPEATS_PER_100", default: 2 },
  { name: "rewrite_gate.MIN_REPEATS", default: 2 },
  { name: "rewrite_gate.WORD_SIGNAL_FLOOR", default: 0.7 },
  { name: "moment_pick.FLOOR", default: 0.6 },
  { name: "take_context.MATCH", default: 0.6 },
];

export const NOTICING_PINNED: { name: string; value: number }[] = [
  { name: "tempo_stretch.GREEN_LOW", value: 0.275 },
  { name: "tempo_stretch.GREEN_HIGH", value: 0.725 },
  { name: "tempo_land.MIN_MS", value: 20_000 },
  { name: "tempo_land.GREEN_SHARE", value: LAND_GREEN_SHARE },
];

const step = (partial: WalkStepDef): WalkStepDef => partial;

export function speakingCoachSeed(): CoachDefinition {
  return {
    schema: 1,
    id: "speaking-coach",
    name: "Speaking coach",
    version: 1,
    chat: {
      spec: "Speaking coach",
      name: null,
      line: "People come to you to speak so others listen.",
      hello: "Hi. Record a short talk, and I'll tell you what worked.",
      questions: [
        { q: "What talk are you getting ready for?" },
        { q: "Who will be listening?" },
        { q: "What is the one thing they should remember?" },
      ],
      taps: ["Practise a talk", "Get ready for a pitch", "Answer a hard question"],
      send: ["rec", "text"],
      out: "words",
      who: "shadow",
      care: false,
      live: false,
    },
    shell: {
      surfaces: ["feedback_walk", "ideal_text"],
      primaryAction: { beforePractice: "Start recording", afterPractice: "Continue recording" },
      recordingClockSeconds: 300,
      presentationLimitChoices: [3, 5, 10, 30, 60, "other", "none"],
      checkpoint: "slide_and_step",
      postWalk: "project_questions",
      publicLink: "hardcoded_will",
      invite: "Tell me what you'd like to do, and I'll show you where.",
      subtitle: "You run this chat.",
      historyCard: { showProgress: true },
      questions: [],
    },
    will: {
      composer: "text",
      recording: false,
      readsAllProjects: true,
      principles: "propose_then_accept",
      patterns: { minProjects: 3, cadence: "weekly" },
    },
    walk: {
      steps: [
        step({ key: "page", screen: "walk.page", when: "always", fixed: "" }),
        step({ key: "coachnote", screen: "walk.message", when: "has_coach_note", fixed: "" }),
        step({ key: "praise", screen: "walk.audio", when: "has_strongest", fixed: ONE_THING_COPY.best, voice: "praise" }),
        step({ key: "clearer", screen: "walk.clearer", when: "one_fix_is_moment", fixed: ONE_THING_COPY.sayStraight, lines: [ONE_THING_COPY.one, ONE_THING_COPY.sayStraight], voice: "try" }),
        step({ key: "exVideo", screen: "walk.aiVoice", when: "one_fix_is_moment", fixed: ONE_THING_COPY.likeConfident }),
        step({ key: "practise", screen: "walk.practise", when: "practice_on", fixed: ONE_THING_COPY.yourTurn, lines: [ONE_THING_COPY.yourTurn], choices: [ONE_THING_COPY.tryIt, ONE_THING_COPY.keepMine] }),
        step({ key: "tempo", screen: "walk.tempo", when: "one_fix_is_tempo", fixed: ONE_THING_COPY.letItBreathe, variants: [{ id: "slow", fixed: ONE_THING_COPY.keepItMoving }], speaker: "stretch" }),
        step({ key: "coach", screen: "walk.message", when: "always", fixed: "" }),
        step({ key: "others", screen: "walk.others", when: "from_take_2", fixed: ONE_THING_COPY.judgeIntro }),
        step({ key: "words", screen: "walk.words", when: "always", fixed: ONE_THING_COPY.helperWords, speaker: "fix" }),
        step({ key: "done", screen: "walk.done", when: "always", fixed: ONE_THING_COPY.lessonDone }),
        step({ key: "summary", screen: "walk.message", when: "legacy_take", fixed: "" }),
        step({ key: "end", screen: "walk.end", when: "always", fixed: "" }),
      ],
      maxTries: { oneThing: ONE_THING_TRIES, legacy: WALK_MAX_TRIES },
      voice: { rulesId: "walk_voice.system", maxSentences: 2, maxChars: 220, forbidNumbers: true },
    },
    noticing: { dials: NOTICING_DIALS.map((d) => ({ ...d })), pinned: NOTICING_PINNED.map((d) => ({ ...d })) },
    plugins: [],
    screens: [
      { id: "recording", states: [
        { id: "before", lines: ["Start recording"] },
        { id: "after", lines: ["Continue recording"] },
      ] },
      { id: "ideal", states: [{ id: "empty", lines: ["Your ideal text"] }] },
      { id: "processing", states: [{ id: "wait", lines: [...PROCESSING_STAGES] }] },
      { id: "tries", states: [
        { id: "landed", lines: [ONE_THING_COPY.landed] },
        { id: "once", lines: [ONE_THING_COPY.onceMore] },
        { id: "done", lines: [ONE_THING_COPY.takeItWithYou] },
        { id: "skip", lines: [ONE_THING_COPY.skipped] },
      ] },
    ],
    theme: {
      canvasMaxPx: 1080,
      color: {
        background: "#ffffff",
        foreground: "#121212",
        muted: "#f5f5f5",
        mutedForeground: "#737373",
        border: "#ebebeb",
        primary: "#ff6a14",
        primaryForeground: "#ffffff",
        record: "#e23b32",
      },
      radius: { bubble: 16, card: 20, chunk: 13, dock: 999 },
    },
  };
}

/** Lines the seed must keep equal to the signed modules. */
export const SEEDED_LINES = {
  best: ONE_THING_COPY.best,
  one: ONE_THING_COPY.one,
  letItBreathe: ONE_THING_COPY.letItBreathe,
  keepItMoving: ONE_THING_COPY.keepItMoving,
  helperWords: ONE_THING_COPY.helperWords,
  lessonDone: ONE_THING_COPY.lessonDone,
  landed: ONE_THING_COPY.landed,
  onceMore: ONE_THING_COPY.onceMore,
  takeItWithYou: ONE_THING_COPY.takeItWithYou,
  ends: TEMPO_COPY.ends,
} as const;
