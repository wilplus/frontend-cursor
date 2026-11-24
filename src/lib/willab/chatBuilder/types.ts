/* The coach as a document (docs/chat-builder/DESIGN.md). A missing or
   refused document leaves the walk on the constants it uses today. */

export const SCHEMA = 1;

export const SCREENS = [
  "walk.page",
  "walk.message",
  "walk.audio",
  "walk.clearer",
  "walk.practise",
  "walk.tempo",
  "walk.aiVoice",
  "walk.others",
  "walk.words",
  "walk.done",
  "walk.end",
  "shell.idealText",
  "shell.recording",
  "shell.picker",
  "will.composer",
  "will.sunday",
  "will.plan",
] as const;

export type ScreenId = (typeof SCREENS)[number];

/** The four types the serving layer actually returns. */
export const PLUGIN_TYPES = ["REWRITE", "EMPHASISE", "ADD", "NOTICE"] as const;
export type PluginType = (typeof PLUGIN_TYPES)[number];

export type StepWhen =
  | "always"
  | "has_coach_note"
  | "has_strongest"
  | "one_fix_is_moment"
  | "one_fix_is_tempo"
  | "one_fix_is_none"
  | "from_take_2"
  | "not_guest"
  | "practice_on"
  | "legacy_take"
  | "never";

export type VoiceStep = "praise" | "try" | "good_take" | "after_try";

export type WalkStepDef = {
  key: string;
  screen: ScreenId;
  when: StepWhen;
  /** The signed line. Empty when the step has no sentence of its own. */
  fixed: string;
  /** Every signed sentence on this step, in the order a speaker meets them.
   *  When omitted, the step's sentence is `fixed` alone. */
  lines?: string[];
  /** Another signed sentence for the same step, chosen by id. */
  variants?: { id: string; fixed: string }[];
  /** The two taps on this step, nearest the thumb last. */
  choices?: [string, string];
  /** Optional walk-voice slot. Never set on the tempo step. */
  voice?: VoiceStep;
  speaker?: "stretch" | "best" | "fix";
};

export type CoachDefinition = {
  schema: 1;
  id: string;
  name: string;
  version: number;
  chat: {
    spec: string;
    name: string | null;
    line: string;
    hello: string;
    questions: { q: string }[];
    taps: string[];
    send: ("rec" | "text" | "photo" | "file")[];
    out: "answer" | "words" | "todo" | "mark";
    who: "shadow" | "you" | "assistant";
    care: boolean;
    live: boolean;
  };
  shell: {
    surfaces: ["feedback_walk", "ideal_text"];
    primaryAction: { beforePractice: string; afterPractice: string };
    recordingClockSeconds: 300;
    presentationLimitChoices: (number | "other" | "none")[];
    checkpoint: "slide_and_step";
    postWalk: "project_questions";
    publicLink: "hardcoded_will";
    invite: string;
    subtitle: string;
    /** Lounge questions already in the product. Not the prototype's three. */
    questions: { q: string; taps: string[] }[];
  };
  will: {
    composer: "text";
    recording: false;
    readsAllProjects: true;
    principles: "propose_then_accept";
    patterns: { minProjects: number; cadence: "weekly" };
  };
  walk: {
    steps: WalkStepDef[];
    maxTries: { oneThing: number; legacy: number };
    voice: { rulesId: string; maxSentences: number; maxChars: number; forbidNumbers: true };
  };
  noticing: {
    dials: { name: string; default: number | string }[];
    pinned: { name: string; value: number | string }[];
  };
  plugins: { id: string; hash: string; role: "detector" | "step" | "copy"; interventionType: PluginType }[];
  /** Recording, the wait, Ideal Text's empty name, and the tries. Absent on an older document: the screens keep today's words. */
  screens?: ScreenDef[];
  theme: {
    canvasMaxPx: 1080;
    color: {
      background: string;
      foreground: string;
      muted: string;
      mutedForeground: string;
      border: string;
      primary: string;
      primaryForeground: string;
      record: string;
    };
    radius: { bubble: number; card: number; chunk: number; dock: number };
  };
};

/** One state of a screen the coach can name: its sentences, then two taps. */
export type ScreenState = { id: string; lines: string[]; choices?: [string, string] };

/** A screen the product already has. The id is the screen, not a special case. */
export type ScreenDef = { id: string; states: ScreenState[] };

export type PluginStatus = "draft" | "checked" | "rejected";

export type PluginDraft = {
  status: PluginStatus;
  hash: string;
  source: string;
  reasons: string[];
  manifest: { id: string; role: string; interventionType: string; hears: string; step: string } | null;
};
