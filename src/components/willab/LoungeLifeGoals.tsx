"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Mic, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import {
  HORIZONS,
  LIFE_GOALS_COPY as COPY,
  SPACES,
  SPACE_ORDER,
  STEPS_BACK,
  horizonDate,
  ladderRungs,
  quarterEnd,
  quarterQuestion,
  stepDate,
  stepQuestion,
  dayLabel,
  type Rung,
} from "@/lib/willab/lifeGoals";
import {
  answerLifeGoalsAsk,
  changeStep,
  draftGoal,
  finishGoal,
  getLifeGoals,
  redraftGoal,
  saveDraft,
  transcribeAnswer,
  type ChangeableStep,
  type Ladder,
  type LifeGoal,
  type LifeGoalsState,
  type SpaceKey,
} from "@/services/api/lifeGoals";
import OverlayCloseButton from "./OverlayCloseButton";
import { CHUNK_DELAY_MS, TypingGlyph } from "./TypingDots";
import { clock, useVoiceNote } from "./useVoiceNote";
import WalkStage from "./walk/WalkStage";
import WalkMessage from "./walk/WalkMessage";
import { WalkSpeakerBubble } from "./walk/WalkThread";
import { WalkLink, WalkPill } from "./walk/WalkFooter";

/* -------------------------------------------------------------------------- */
/*  Life goals in the Lounge (Will learning plan, step 3; backend N172, rules  */
/*  docs/flows/feedback-walk-and-chat.md §1 M, prototype                        */
/*  https://claude.ai/artifact/HaWehtwfg1jzJvGeGM1c24 version 7). Founder only */
/*  (ring 6): the backend says whether it is on.                              */
/*                                                                            */
/*  The lens is the Feedback walk's frame (WalkStage's motion, the bar         */
/*  "‹ Life goals ›" and ✕, the thread growing by taps, the dock under it):   */
/*  one goal per sitting, the questions one per screen, each answer saved on  */
/*  the draft so the lens reopens where it stopped. The flow reads as a       */
/*  script: Will says, the dock asks, the answer lands as the speaker's       */
/*  orange bubble.                                                            */
/* -------------------------------------------------------------------------- */

export type LensOpen = {
  mode: "add" | "see";
  /** The ask said what they want ("I want to get healthier"). */
  said?: string;
  space?: SpaceKey;
  /** See one goal only (its ladder bubble's ›). */
  goalId?: string;
};

type Item = { id: number; who: "will" | "me"; node: ReactNode };

/** The lens was closed: the script stops where it stands. */
class Closed extends Error {}

type Ui = {
  add: (who: Item["who"], node: ReactNode) => void;
  typing: (on: boolean) => void;
  dock: (node: ReactNode) => void;
  alive: () => boolean;
  /** Replaying a draft's answered questions: no dots, no waits. */
  fast: { current: boolean };
};

function script(ui: Ui) {
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => (ui.alive() ? resolve() : reject(new Closed())), ui.fast.current ? 0 : ms),
    );
  async function say(...nodes: ReactNode[]) {
    for (const node of nodes) {
      if (!ui.fast.current) {
        ui.typing(true);
        await wait(CHUNK_DELAY_MS);
        ui.typing(false);
      }
      ui.add("will", node);
      await wait(CHUNK_DELAY_MS);
    }
  }
  async function me(node: ReactNode) {
    ui.add("me", node);
    await wait(200);
  }
  function ask<T>(render: (done: (value: T) => void) => ReactNode): Promise<T> {
    if (!ui.alive()) return Promise.reject(new Closed());
    return new Promise<T>((resolve) =>
      ui.dock(
        render((value) => {
          ui.dock(null);
          resolve(value);
        }),
      ),
    );
  }
  return { say, me, ask, fast: ui.fast };
}

type Script = ReturnType<typeof script>;

/* ── The dock ──────────────────────────────────────────────────────────── */

type Tap = { emoji?: string; label: string };

/** The judgement's tall full-width answers (C8): the one tapped fills black,
 *  holds a moment, then lands as the speaker's bubble. */
function TapsDock({ options, onPick }: { options: readonly Tap[]; onPick: (index: number) => void }) {
  const [held, setHeld] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2.5 px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">
      {options.map((option, index) => (
        <button
          key={option.label}
          type="button"
          disabled={held !== null}
          onClick={() => {
            setHeld(index);
            setTimeout(() => onPick(index), WALK_ANSWER_HOLD_MS);
          }}
          className={cn(
            "walk-press walk-fill flex min-h-[72px] items-center gap-[18px] rounded-2xl border-[1.5px] px-[22px] text-left text-[21px] font-semibold",
            held === index ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
          )}
        >
          {option.emoji ? (
            <span aria-hidden="true" className="text-[30px] leading-none">
              {option.emoji}
            </span>
          ) : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DockColumn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">{children}</div>;
}

const FIELD =
  "w-full resize-none rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-[17px] leading-[1.5] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";

/** Said with the small mic, or typed; Skip leaves it. ``null`` is a skip. */
function WordsDock({ onAnswer }: { onAnswer: (text: string | null) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const note = useVoiceNote({
    maxSeconds: 300,
    onDone: async (audio) => {
      setSending(true);
      const words = await transcribeAnswer(audio);
      setSending(false);
      if (words) onAnswer(words);
    },
  });
  if (note.phase === "recording" || sending) {
    return (
      <DockColumn>
        <div data-life-goals-recording className="flex items-center gap-1">
          <button
            type="button"
            onClick={note.cancel}
            disabled={sending}
            aria-label="Delete"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex h-10 flex-1 items-center gap-2 rounded-3xl border border-border bg-background px-3.5 text-[15px] tabular-nums">
            {sending ? <TypingGlyph /> : <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />}
            {sending ? null : clock(note.elapsedMs)}
          </div>
          <button
            type="button"
            onClick={note.send}
            disabled={sending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <WalkLink action={{ label: COPY.typeInstead, onClick: note.cancel, disabled: sending }} />
      </DockColumn>
    );
  }
  return (
    <DockColumn>
      <div className="relative">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={COPY.field}
          aria-label={COPY.field}
          className={cn(FIELD, "pr-14")}
        />
        <button
          type="button"
          onClick={() => void note.start()}
          aria-label="Voice note"
          className="absolute bottom-2 right-2 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-foreground text-background"
        >
          <Mic className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <WalkPill action={{ label: COPY.next, onClick: () => onAnswer(text.trim()), disabled: !text.trim() }} />
      <WalkLink action={{ label: COPY.skip, onClick: () => onAnswer(null) }} />
    </DockColumn>
  );
}

/** A field with the words, a black pill to keep them, and Back when there is
 *  somewhere to go back to. */
function EditorDock({
  value,
  label,
  onKeep,
  onBack,
}: {
  value: string;
  label: string;
  onKeep: (text: string) => void;
  onBack?: () => void;
}) {
  const [text, setText] = useState(value);
  return (
    <DockColumn>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} />
      <WalkPill action={{ label, onClick: () => onKeep(text.trim()), disabled: !text.trim() }} />
      {onBack ? <WalkLink action={{ label: COPY.back, onClick: onBack }} /> : null}
    </DockColumn>
  );
}

/* ── The ladder ────────────────────────────────────────────────────────── */

function RungBody({ rung, small }: { rung: Rung; small: boolean }) {
  return (
    <>
      <span className={cn("block font-semibold tracking-[0.02em] text-muted-foreground", small ? "text-[11.5px]" : "text-[13.5px]")}>
        {rung.label}
        {rung.note ? <span className="font-medium"> · {rung.note}</span> : null}
      </span>
      {rung.text}
      {rung.earlier ? (
        <span className={cn("mt-1 block text-muted-foreground", small ? "text-[12.5px]" : "text-[13.5px]")}>
          {COPY.earlier} {rung.earlier}
        </span>
      ) : null}
    </>
  );
}

/** One goal's ladder (M10). With ``onPick`` each step but this week's is a
 *  row with › that changes it (M11). */
export function LadderCard({
  goal,
  onPick,
  small = false,
}: {
  goal: Pick<LifeGoal, "space" | "ladder" | "changes" | "talk">;
  onPick?: (rung: Rung) => void;
  small?: boolean;
}) {
  const space = SPACES[goal.space];
  return (
    <span data-life-goal-ladder className="flex flex-col gap-0.5">
      <b>
        {space.emoji} {space.name}
      </b>
      {ladderRungs(goal).map((rung) =>
        onPick ? (
          <button
            key={rung.step}
            type="button"
            onClick={() => onPick(rung)}
            className="relative block w-full border-t border-foreground/10 py-1.5 pr-7 text-left first-of-type:border-t-0"
          >
            <RungBody rung={rung} small={small} />
            <ChevronRight aria-hidden className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          </button>
        ) : (
          <span key={rung.step} className="block py-0.5">
            <RungBody rung={rung} small={small} />
          </span>
        ),
      )}
    </span>
  );
}

/** A set goal's ladder in the Lounge: its › opens the lens on it (M10). */
export function LifeGoalBubble({ goal, onOpen }: { goal: LifeGoal; onOpen: () => void }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="relative rounded-[16px] bg-muted px-3 py-2 pr-8 text-left text-[15px] leading-[1.45] text-foreground"
      >
        <LadderCard goal={goal} small />
        <ChevronRight aria-hidden className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      </button>
    </div>
  );
}

/** A Lounge row's set goal, read defensively, or null. */
export function lifeGoalOf(metadata: Record<string, unknown> | null | undefined): LifeGoal | null {
  const goal = metadata?.life_goal as LifeGoal | undefined;
  return goal && typeof goal.id === "string" && goal.space in SPACES && goal.ladder ? goal : null;
}

/* ── The flows ─────────────────────────────────────────────────────────── */

type Ctx = {
  s: Script;
  state: LifeGoalsState;
  /** The Lounge reads its thread again (a set goal is in it). */
  reload: () => Promise<unknown>;
  refresh: () => Promise<void>;
};

const tapsOf = (s: Script, options: readonly Tap[]) =>
  s.ask<number>((done) => <TapsDock options={options} onPick={done} />);

async function tapAnswer(s: Script, options: readonly Tap[]): Promise<number> {
  const index = await tapsOf(s, options);
  const option = options[index];
  await s.me(option.emoji ? `${option.emoji} ${option.label}` : option.label);
  return index;
}

async function wordsAnswer(s: Script): Promise<string | null> {
  const text = await s.ask<string | null>((done) => <WordsDock onAnswer={done} />);
  await s.me(text ?? COPY.skip);
  return text;
}

async function acceptOrEdit(s: Script, value: string): Promise<string> {
  for (;;) {
    const choice = await s.ask<"accept" | "edit">((done) => (
      <DockColumn>
        <WalkPill action={{ label: COPY.accept, onClick: () => done("accept") }} />
        <WalkPill outline action={{ label: COPY.edit, onClick: () => done("edit") }} />
      </DockColumn>
    ));
    if (choice === "accept") {
      await s.me(COPY.accept);
      return value;
    }
    const edited = await s.ask<string | null>((done) => (
      <EditorDock value={value} label={COPY.keepGoal} onKeep={done} onBack={() => done(null)} />
    ));
    if (edited) {
      await s.me(edited);
      return edited;
    }
  }
}

function Quote({ goal, quotes }: { goal: string; quotes: readonly string[] }) {
  return (
    <>
      <b>{goal}</b>
      {quotes.length ? (
        <span className="mt-1 block text-[13.5px] leading-[1.4] text-muted-foreground">
          {COPY.from} “{quotes.join("” · “")}”
        </span>
      ) : null}
    </>
  );
}

/** One sitting's goal as it grows: saved as a draft after every answer, so
 *  the lens reopens where it stopped. */
type Sitting = {
  ctx: Ctx;
  s: Script;
  id: string | null;
  space: SpaceKey;
  ladder: Ladder;
  answers: NonNullable<Ladder["answers"]>;
  done: Set<string>;
  replaces: string | null;
  saving: Promise<unknown>;
};

function keep(sit: Sitting, key: string): void {
  sit.done.add(key);
  sit.ladder.answers = sit.answers;
  sit.ladder.progress = [...sit.done].join(",");
  const ladder = { ...sit.ladder };
  sit.saving = sit.saving.then(async () => {
    const saved = await saveDraft(sit.id, sit.space, ladder);
    if (saved) sit.id = saved.id;
  });
}

/** One goal, start to ladder (M3 to M10). */
async function addGoal(ctx: Ctx, open: LensOpen): Promise<void> {
  const { s, state } = ctx;
  const resume = state.draft && !open.said ? state.draft : null;
  const ladder: Ladder = { ...(resume?.ladder ?? {}) };
  const done = new Set((ladder.progress ?? "").split(",").filter(Boolean));
  // A draft reopens where it stopped: its answered questions show at once.
  s.fast.current = resume !== null;
  const space = resume ? await shownSpace(s, resume.space) : await pickSpace(ctx, open);
  const sit: Sitting = {
    ctx, s, id: resume?.id ?? null, space, ladder, answers: { ...(ladder.answers ?? {}) }, done,
    replaces: [...done].find((key) => key.startsWith("replace:"))?.slice(8) ?? null,
    saving: Promise.resolve(),
  };
  await keepOrReplace(sit);
  await openQuestions(sit, open.said ?? ladder.said);
  s.fast.current = false;
  if (!(await drafted(sit))) {
    await s.say(COPY.nothing);
    return;
  }
  await longRun(sit);
  await ambitious(sit);
  await s.say(COPY.giveUp);
  ladder.give = (await wordsAnswer(s)) ?? undefined;
  keep(sit, "give");
  await workBack(ctx, ladder, (key) => keep(sit, key));
  await setGoal(sit);
}

async function shownSpace(s: Script, space: SpaceKey): Promise<SpaceKey> {
  await s.say(COPY.whichSpace);
  await s.me(`${SPACES[space].emoji} ${SPACES[space].name}`);
  return space;
}

/** The space already holds a goal: keep both, or replace it (M3). */
async function keepOrReplace(sit: Sitting): Promise<void> {
  const held = sit.ctx.state.goals.filter((goal) => goal.space === sit.space);
  if (!held.length || sit.done.has("replace")) return;
  await sit.s.say(COPY.alreadyHas(sit.space), <b key="held">{held[0].ladder.goal}</b>, COPY.keepOrReplace);
  const index = await tapAnswer(sit.s, [{ emoji: "➕", label: COPY.keepBoth }, { emoji: "🔁", label: COPY.replace }]);
  sit.replaces = index === 1 ? held[0].id : null;
  keep(sit, sit.replaces ? `replace:${sit.replaces}` : "replace");
  sit.done.add("replace");
}

/** The three open questions (M4); what the ask already said is quoted. */
async function openQuestions(sit: Sitting, said: string | undefined): Promise<void> {
  const { s, answers } = sit;
  if (said) {
    sit.ladder.said = said;
    answers.want_most = said;
    await s.say(COPY.youSaid(said));
    keep(sit, "want_most");
  }
  const questions = [
    ["want_most", COPY.wantMost(sit.space)],
    ["fulfil", COPY.fulfil],
    ["nature", COPY.nature],
  ] as const;
  for (const [key, question] of questions) {
    if (key === "want_most" && said) continue;
    await s.say(question);
    if (sit.done.has(key)) await s.me(answers[key] ?? COPY.skip);
    else answers[key] = (await wordsAnswer(s)) ?? undefined;
    keep(sit, key);
  }
}

/** Will's draft from their words, accepted or edited (M5); false when they
 *  said nothing it could draft from. */
async function drafted(sit: Sitting): Promise<boolean> {
  const { s, ladder, answers } = sit;
  const emoji = SPACES[sit.space].emoji;
  if (sit.done.has("draft") && ladder.goal) {
    await s.say(COPY.draftLead, <Quote key="draft" goal={`${emoji} ${ladder.goal}`} quotes={ladder.quotes ?? []} />);
    await s.me(COPY.accept);
    return true;
  }
  if (!answers.want_most && !answers.fulfil && !answers.nature) return false;
  const draft = await draftGoal(sit.space, answers);
  if (!draft.goal) return false;
  await s.say(COPY.draftLead, <Quote key="draft" goal={`${emoji} ${draft.goal}`} quotes={draft.quotes} />);
  ladder.goal = await acceptOrEdit(s, draft.goal);
  ladder.quotes = draft.quotes;
  keep(sit, "draft");
  return true;
}

/** The long run, or a want now; under a want, the goal it gives (M6). */
async function longRun(sit: Sitting): Promise<void> {
  const { s, ladder } = sit;
  await s.say(COPY.longRun);
  const now = (await tapAnswer(s, [{ emoji: "🎯", label: COPY.theLongRun }, { emoji: "⏳", label: COPY.wantNow }])) === 1;
  if (now) {
    await s.say(COPY.under);
    const under = await wordsAnswer(s);
    const re = under ? await redraftGoal(sit.space, ladder.goal ?? "", under) : null;
    if (under) sit.answers.under = under;
    if (re?.goal) {
      const want = ladder.goal ?? "";
      const quote = <Quote key="under" goal={`${SPACES[sit.space].emoji} ${re.goal}`} quotes={re.quote ? [re.quote] : []} />;
      await s.say(COPY.underLead, quote, COPY.heldWant(want));
      ladder.goal = await acceptOrEdit(s, re.goal);
      ladder.want = want;
    }
  }
  keep(sit, "longrun");
}

/** Ambitious enough, or made bigger (M7). */
async function ambitious(sit: Sitting): Promise<void> {
  const { s, ladder } = sit;
  await s.say(COPY.ambitious);
  if ((await tapAnswer(s, [{ emoji: "🚀", label: COPY.yes }, { emoji: "⬆️", label: COPY.notYet }])) === 1) {
    await s.say(COPY.bigger);
    const bigger = await s.ask<string>((done) => <EditorDock value={ladder.goal ?? ""} label={COPY.keepGoal} onKeep={done} />);
    await s.me(bigger);
    ladder.goal = bigger;
  }
  keep(sit, "ambitious");
}

/** The goal is set: its ladder and "Noted. …", here and in the Lounge (M10). */
async function setGoal(sit: Sitting): Promise<void> {
  await sit.saving;
  if (!sit.id) sit.id = (await saveDraft(null, sit.space, sit.ladder))?.id ?? null;
  const rows = sit.id ? await finishGoal(sit.id, sit.replaces) : null;
  const set = rows?.map((row) => lifeGoalOf(row.metadata)).find(Boolean) ?? null;
  if (set) await sit.s.say(<LadderCard key="ladder" goal={set} />, COPY.setGoal(sit.space));
  await sit.ctx.refresh();
  await sit.ctx.reload();
}

async function pickSpace(ctx: Ctx, open: LensOpen): Promise<SpaceKey> {
  const { s, state } = ctx;
  const has = (space: SpaceKey) => state.goals.some((goal) => goal.space === space);
  if (open.space) {
    await s.say(COPY.soundsLike(open.space));
    const index = await tapAnswer(s, [
      { emoji: SPACES[open.space].emoji, label: COPY.yesSpace(open.space) },
      { emoji: "↔️", label: COPY.anotherSpace },
    ]);
    if (index === 0) return open.space;
  }
  await s.say(COPY.whichSpace);
  const options = SPACE_ORDER.map((space) => ({
    emoji: SPACES[space].emoji,
    label: has(space) ? `${SPACES[space].name} · ${COPY.hasGoal}` : SPACES[space].name,
  }));
  return SPACE_ORDER[await tapAnswer(s, options)];
}

/** By when, then the steps worked back to the quarter (M9). */
async function workBack(ctx: Ctx, ladder: Ladder, keep: (key: string) => void): Promise<void> {
  const { s } = ctx;
  const today = new Date();
  await s.say(COPY.byWhen);
  const horizon = HORIZONS[await tapAnswer(s, HORIZONS)];
  ladder.horizon = horizon.key;
  ladder.horizon_by = horizonDate(today, horizon.key) ?? undefined;
  keep("horizon");
  let above = ladder.horizon_by ?? null;
  let target: string | null = null;
  for (const step of STEPS_BACK[horizon.key]) {
    const date = stepDate(today, step);
    await s.say(stepQuestion(above, date));
    const text = await wordsAnswer(s);
    if (text) {
      ladder.steps = { ...(ladder.steps ?? {}), [step]: { text, by: date } };
      above = date;
      target = text;
    }
    keep(step);
  }
  const quarter = quarterEnd(today);
  if (quarter.next) await s.say(COPY.nearlyOver);
  await s.say(quarterQuestion(quarter.by, quarter.weeks, target));
  const text = await wordsAnswer(s);
  if (text) ladder.quarter = { text, by: quarter.by, next: quarter.next };
  keep("quarter");
}

/** The step below a changed one, when the ladder has it (M11). */
const BELOW: Partial<Record<ChangeableStep, readonly ChangeableStep[]>> = {
  goal: ["y10", "y3", "y1", "quarter"],
  y10: ["y3", "y1", "quarter"],
  y3: ["y1", "quarter"],
  y1: ["quarter"],
};

const RUNG_NAME: Record<ChangeableStep, string> = {
  goal: "Life goal",
  want: "A want, held knowingly",
  give: "Giving up",
  y10: "In ten years",
  y3: "In three years",
  y1: "In a year",
  quarter: "This quarter",
  talk: "Talk goal",
};

function stepText(goal: LifeGoal, step: ChangeableStep): string | undefined {
  return ladderRungs(goal).find((rung) => rung.step === step)?.text;
}

/** "#goals" or a ladder's ›: tap the step that is wrong (M11). */
async function seeGoals(ctx: Ctx, open: LensOpen): Promise<void> {
  const { s } = ctx;
  let goals = ctx.state.goals.filter((goal) => !open.goalId || goal.id === open.goalId);
  if (!goals.length) return;
  type Pick = { goal: LifeGoal; step: ChangeableStep } | null;
  const ladders = (pick: (value: Pick) => void) =>
    goals.map((goal) => (
      <LadderCard key={`${goal.id}-${JSON.stringify(goal.changes)}`} goal={goal} onPick={(rung) => pick({ goal, step: rung.step as ChangeableStep })} />
    ));
  let resolvePick: ((value: Pick) => void) | null = null;
  const choose = (value: Pick) => resolvePick?.(value);
  await s.say(COPY.pickStep, ...ladders(choose));
  let changed = false;
  for (;;) {
    const pick = await s.ask<Pick>((done) => {
      resolvePick = done;
      return (
        <DockColumn>
          {changed ? (
            <WalkPill action={{ label: COPY.done, onClick: () => done(null) }} />
          ) : (
            <WalkLink action={{ label: COPY.allRight, onClick: () => done(null) }} />
          )}
        </DockColumn>
      );
    });
    resolvePick = null;
    if (!pick) {
      if (!changed) {
        await s.me(COPY.allRight);
        await s.say(COPY.noted);
      }
      return;
    }
    const updated = await changeOne(ctx, pick.goal, pick.step);
    if (!updated) continue;
    changed = true;
    goals = goals.map((goal) => (goal.id === updated.id ? updated : goal));
    await s.say(COPY.changedOn(dayLabel(new Date().toISOString())), ...ladders(choose));
  }
}

async function changeOne(ctx: Ctx, goal: LifeGoal, step: ChangeableStep): Promise<LifeGoal | null> {
  const { s } = ctx;
  const now = stepText(goal, step);
  if (!now) return null;
  await s.me(RUNG_NAME[step]);
  if (step === "talk") await s.say(COPY.talkToo);
  await s.say(
    <span key="now">
      {COPY.now} <b>{now}</b>
    </span>,
    COPY.shouldSay,
  );
  const text = await s.ask<string | null>((done) => (
    <EditorDock value={now} label={COPY.keepChange} onKeep={done} onBack={() => done(null)} />
  ));
  if (!text) {
    await s.me(COPY.back);
    return null;
  }
  await s.me(text);
  let updated = (await changeStep(goal.id, step, text)) ?? goal;
  const below = (BELOW[step] ?? []).find((key) => stepText(updated, key));
  const belowText = below ? stepText(updated, below) : undefined;
  if (below && belowText && text !== now) {
    await s.say(COPY.stillGets(belowText));
    const index = await tapAnswer(s, [{ emoji: "✅", label: COPY.stillFits }, { emoji: "✏️", label: COPY.changeToo }]);
    if (index === 1) updated = (await changeOne(ctx, updated, below)) ?? updated;
  }
  await ctx.refresh();
  return updated;
}

/* ── The lens ──────────────────────────────────────────────────────────── */

function LensFrame({
  items,
  typing,
  dock,
  onClose,
}: {
  items: readonly Item[];
  typing: boolean;
  dock: ReactNode;
  onClose: () => void;
}) {
  const body = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, typing, dock]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COPY.bar}
      data-life-goals-lens
      className="walk-ov flex h-full w-full flex-col bg-background pt-[env(safe-area-inset-top)] text-[17px] leading-[1.55] text-foreground"
    >
      <div className="walk-ovtop flex min-h-[44px] items-center justify-between px-2.5 pt-2">
        <nav aria-label={COPY.bar} className="flex min-w-0 items-center gap-0.5 text-[13.5px] font-semibold">
          <span className="flex h-9 w-9 items-center justify-center text-muted-foreground opacity-25" aria-hidden>
            <ChevronLeft className="h-5 w-5" />
          </span>
          <span className="min-w-0 truncate">{COPY.bar}</span>
          <span className="flex h-9 w-9 items-center justify-center text-muted-foreground opacity-25" aria-hidden>
            <ChevronRight className="h-5 w-5" />
          </span>
        </nav>
        <OverlayCloseButton onClick={onClose} className="walk-press-sm mr-2.5" />
      </div>
      <div
        ref={body}
        data-walk-thread-body
        className="scrollbar-none relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-3.5"
      >
        <div className="mt-auto flex flex-col gap-4">
          {items.map((item) =>
            item.who === "me" ? (
              <div key={item.id} className="walk-bubble-in">
                <WalkSpeakerBubble>{item.node}</WalkSpeakerBubble>
              </div>
            ) : (
              <WalkMessage key={item.id} className="walk-bubble-in">
                {item.node}
              </WalkMessage>
            ),
          )}
          {typing ? (
            <div className="flex max-w-[94%]">
              <div className="rounded-[22px] bg-muted px-[17px] py-[19px]">
                <TypingGlyph />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div data-walk-dock>{dock}</div>
    </div>
  );
}

function LifeGoalsLens({
  open,
  state,
  onClose,
  reload,
  refresh,
}: {
  open: (LensOpen & { nonce: number }) | null;
  state: LifeGoalsState | null;
  onClose: () => void;
  reload: () => Promise<unknown>;
  refresh: () => Promise<void>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<ReactNode>(null);
  const run = useRef(0);
  const seq = useRef(0);
  const fast = useRef(false);
  const nonce = open?.nonce;

  useEffect(() => {
    if (!open || !state?.enabled) return;
    const id = ++run.current;
    setItems([]);
    setTyping(false);
    setDock(null);
    const ui: Ui = {
      add: (who, node) => run.current === id && setItems((now) => [...now, { id: ++seq.current, who, node }]),
      typing: (on) => run.current === id && setTyping(on),
      dock: (node) => run.current === id && setDock(node),
      alive: () => run.current === id,
      fast,
    };
    const s = script(ui);
    const ctx: Ctx = { s, state, reload, refresh };
    const flow = open.mode === "see" && state.goals.length ? seeGoals(ctx, open) : addGoal(ctx, open);
    void flow
      .then(() => ui.dock(<DockColumn><WalkPill action={{ label: COPY.close, onClick: onClose }} /></DockColumn>))
      .catch((error: unknown) => {
        if (!(error instanceof Closed)) ui.dock(<DockColumn><WalkPill action={{ label: COPY.close, onClick: onClose }} /></DockColumn>);
      });
    return () => {
      run.current += 1;
    };
    // One run per opening (its nonce); the state it starts from is the one it had then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div data-feedback-walk>
      <WalkStage
        screen={{ key: "life-goals", overlay: Boolean(open) }}
        render={(_screen, ghost) => (
          <LensFrame items={items} typing={!ghost && typing} dock={ghost ? null : dock} onClose={onClose} />
        )}
      />
    </div>
  );
}

/* ── In the Lounge ─────────────────────────────────────────────────────── */

/** Life goals for the Lounge: whether they are on, the ask's answer, and
 *  the lens. */
export function useLifeGoals({ signedIn, reload }: { signedIn: boolean; reload: () => Promise<unknown> }) {
  const [state, setState] = useState<LifeGoalsState | null>(null);
  const [open, setOpen] = useState<(LensOpen & { nonce: number }) | null>(null);
  const refresh = useCallback(async () => {
    setState(await getLifeGoals());
  }, []);
  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn, refresh]);

  const openLens = useCallback(
    (spec: LensOpen) => {
      void refresh().then(() => setOpen({ ...spec, nonce: Date.now() }));
    },
    [refresh],
  );

  async function answerAsk(choice: "start" | "not_now"): Promise<void> {
    if (!(await answerLifeGoalsAsk(choice))) return;
    await reload();
    if (choice === "start") openLens({ mode: "add" });
  }

  return {
    enabled: state?.enabled === true,
    openLens,
    answerAsk: (choice: "start" | "not_now") => void answerAsk(choice),
    lens: (
      <LifeGoalsLens open={open} state={state} onClose={() => setOpen(null)} reload={reload} refresh={refresh} />
    ),
  };
}

export type LifeGoals = ReturnType<typeof useLifeGoals>;

/** What a chat reply asks of the lens (M2): ``{"life_goals_open": "add" |
 *  "see", "said"?, "space"?}`` in its row metadata. Not an offer: the lens
 *  opens by itself, because they asked. */
export function lensAskOf(metadata: Record<string, unknown> | null | undefined): LensOpen | null {
  const mode = metadata?.life_goals_open;
  if (!metadata || (mode !== "add" && mode !== "see")) return null;
  return {
    mode,
    said: typeof metadata.said === "string" ? metadata.said : undefined,
    space: typeof metadata.space === "string" && metadata.space in SPACES ? (metadata.space as SpaceKey) : undefined,
  };
}
