/* What a speaker meets, taken two ways: from the walk's own signed lines,
   and from the coach document. A difference is a line the document does
   not carry yet. */

import { ONE_THING_COPY } from "@/components/willab/idealEditCopy";
import { buildWalkPlan, walkMoments, type WalkPlanInput } from "@/lib/willab/walkPlan";
import { middleOf, plusRows, takesFromSend, type Middle } from "@/components/willab/chats/ChatBar";
import type { CoachDefinition } from "./types";
import { planFromDefinition } from "./runtime";

export type BarFace = { middle: Middle; plus: string[]; thanks: boolean };

export type CoachFace = {
  chat: CoachDefinition["chat"];
  bars: { nothing: BarFace; asks: BarFace; photo: BarFace };
  walkKeys: { praise: string[]; moment: string[]; tempo: string[] };
  lines: Record<string, string[]>;
  choices: Record<string, string[]>;
};

const strongest = { start: 10, slide: 1, blockId: "b", tiered: true, green: true, walkSlot: "strongest" as const };
const between = { start: 0, slide: 0, blockId: "a", tiered: true, practicePrompt: true, hasRewrite: true, walkSlot: "between" as const };
const weakest = { start: 20, slide: 2, blockId: "c", tiered: true, practicePrompt: true, walkSlot: "weakest" as const };

function keys(input: WalkPlanInput, def?: CoachDefinition): string[] {
  const plan = def ? planFromDefinition(def, input) : buildWalkPlan(input);
  if (!Array.isArray(plan)) throw new Error("refused");
  return plan.map((s) => s.key);
}

function input(items: Parameters<typeof walkMoments>[0], extra: Partial<WalkPlanInput> = {}): WalkPlanInput {
  return { moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false, ...extra };
}

function bar(send: CoachDefinition["chat"]["send"], asked: { answer: boolean; taps: boolean; photo: boolean }): BarFace {
  const takes = takesFromSend(send);
  if (!takes) throw new Error("send");
  return { middle: middleOf(takes, asked), plus: plusRows(takes, asked, false), thanks: false };
}

/** The sentences the walk already shows, read from the signed copy. */
export function productLines(): Record<string, string[]> {
  return {
    praise: [ONE_THING_COPY.best],
    clearer: [ONE_THING_COPY.one, ONE_THING_COPY.sayStraight],
    exVideo: [ONE_THING_COPY.likeConfident],
    practise: [ONE_THING_COPY.yourTurn],
    tempo: [ONE_THING_COPY.letItBreathe],
    tempoSlow: [ONE_THING_COPY.keepItMoving],
    others: [ONE_THING_COPY.judgeIntro],
    words: [ONE_THING_COPY.helperWords],
    done: [ONE_THING_COPY.lessonDone],
  };
}

export function productChoices(): Record<string, string[]> {
  return { practise: [ONE_THING_COPY.tryIt, ONE_THING_COPY.keepMine] };
}

function stepLines(def: CoachDefinition, key: string): string[] {
  const step = def.walk.steps.find((s) => s.key === key);
  if (!step) return [];
  if (step.lines?.length) return step.lines;
  return step.fixed ? [step.fixed] : [];
}

/** The same face, read from a coach document. */
export function faceFromDefinition(def: CoachDefinition): CoachFace {
  const asked = { taps: false as const };
  const slow = def.walk.steps.find((s) => s.key === "tempo")?.variants?.find((v) => v.id === "slow")?.fixed;
  return {
    chat: def.chat,
    bars: {
      nothing: bar(def.chat.send, { ...asked, answer: false, photo: false }),
      asks: bar(def.chat.send, { ...asked, answer: true, photo: false }),
      photo: bar(def.chat.send, { ...asked, answer: false, photo: true }),
    },
    walkKeys: {
      praise: keys(input([strongest]), def),
      moment: keys(input([between, strongest, weakest], { judge: true }), def),
      tempo: keys(input([{ ...strongest, oneFix: "tempo" }]), def),
    },
    lines: {
      ...Object.fromEntries(["praise", "clearer", "exVideo", "practise", "tempo", "others", "words", "done"].map((key) => [key, stepLines(def, key)])),
      tempoSlow: slow ? [slow] : [],
    },
    choices: Object.fromEntries(def.walk.steps.filter((s) => s.choices).map((s) => [s.key, [...s.choices!]])),
  };
}

/** The walk the app builds when no document is published. */
export function productWalkKeys(): CoachFace["walkKeys"] {
  return {
    praise: keys(input([strongest])),
    moment: keys(input([between, strongest, weakest], { judge: true })),
    tempo: keys(input([{ ...strongest, oneFix: "tempo" }])),
  };
}

export type Gap = { item: string; product: string; builder: string };

/** Items where the document and the product disagree. Empty means parity. */
export function parityGaps(def: CoachDefinition): Gap[] {
  const face = faceFromDefinition(def);
  const gaps: Gap[] = [];
  const lines = productLines();
  for (const key of Object.keys(lines)) {
    const got = (face.lines[key] ?? []).join(" | ");
    const want = lines[key].join(" | ");
    if (got !== want) gaps.push({ item: `line:${key}`, product: want, builder: got });
  }
  const choices = productChoices();
  for (const key of Object.keys(choices)) {
    const got = (face.choices[key] ?? []).join(" | ");
    const want = choices[key].join(" | ");
    if (got !== want) gaps.push({ item: `choices:${key}`, product: want, builder: got });
  }
  const walks = productWalkKeys();
  for (const key of ["praise", "moment", "tempo"] as const) {
    const got = face.walkKeys[key].join(",");
    const want = walks[key].join(",");
    if (got !== want) gaps.push({ item: `walk:${key}`, product: want, builder: got });
  }
  return gaps;
}
