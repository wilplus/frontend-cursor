"use client";

import { useEffect, useRef, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import WalkMessage from "../walk/WalkMessage";
import {
  answerExample,
  getModelPage,
  getQueue,
  type Answered,
  type Recipe,
  type TeachExample,
  type TeachScreen,
  type Trust,
} from "@/services/api/models";
import { cn } from "@/lib/utils";
import { ExampleCase } from "./ModelBits";
import { JUDGE_FACES, MODELS_WORDS as W, teachCaption } from "./modelsCopy";
import { choicesOf, isJudge, recipeSteps, teachScreen } from "./teachSteps";

/* -------------------------------------------------------------------------- */
/*  Teaching, one example after the other from the one queue (backend N563,   */
/*  N566 item 7, N570; the locked prototype's d:5, d:6, q:3 to q:6).          */
/*                                                                            */
/*  Blind (Never 2, N518 item 4): the screen reads the queue, whose examples   */
/*  carry the teacher's fields only, and the model's page for its recipe.    */
/*  Nothing of the machine's read is asked for, before or after an answer.   */
/*                                                                            */
/*  After an answer the backend says what follows: "Counts for … both ask     */
/*  this question" (MOD-16), another model's question on the same clip,      */
/*  drawn without loading the clip again (MOD-17), and once, "Your answers    */
/*  now count." (MOD-10). While the quiet trust check runs nothing is said:   */
/*  no screen says a teacher is on trial and no score is shown.              */
/*                                                                            */
/*  "Record your answer" waits for the chats' recording path to hand a        */
/*  model the words of a spoken answer; until then it is drawn and does       */
/*  nothing unless the caller passes `onRecordAnswer`.                       */
/* -------------------------------------------------------------------------- */

type ModelInfo = { name: string; recipe: Recipe | undefined };
type Follow = Answered["follow"][number];

/** How long a saved answer stays on screen with its note before the next. */
export const TEACH_HOLD_MS = 1200;

function useTeachQueue(only: string | null) {
  const [examples, setExamples] = useState<TeachExample[] | null>(null);
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  useEffect(() => {
    let alive = true;
    void (async () => {
      const queue = await getQueue(only);
      const list = queue?.examples ?? [];
      const ids = [...new Set(list.map((e) => e.model_id))];
      const pages = await Promise.all(ids.map((id) => getModelPage(id)));
      if (!alive) return;
      const byId: Record<string, ModelInfo> = {};
      ids.forEach((id, i) => {
        const row = queue?.models.find((m) => m.id === id);
        byId[id] = { name: pages[i]?.name ?? row?.name ?? "", recipe: pages[i]?.recipe };
      });
      setModels(byId);
      setExamples(list);
    })();
    return () => {
      alive = false;
    };
  }, [only]);
  return { examples, models };
}

function Faces({ answers, chosen, onPick }: { answers: string[]; chosen: string | null; onPick: (a: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      {answers.map((a) => (
        <button
          key={a}
          type="button"
          data-model-answer={a}
          aria-pressed={chosen === a}
          disabled={chosen !== null}
          onClick={() => onPick(a)}
          className={cn(
            "walk-press flex max-h-[120px] min-h-[72px] flex-1 items-center gap-[18px] rounded-2xl border-[1.5px] bg-background px-[22px] text-left text-[21px] font-semibold text-foreground",
            chosen === a ? "border-foreground" : "border-border",
            chosen !== null && chosen !== a && "opacity-35",
          )}
        >
          <span aria-hidden className="text-[36px] leading-none">{JUDGE_FACES[a] ?? ""}</span>
          {a}
        </button>
      ))}
    </div>
  );
}

function Choices({ answers, chosen, numbered, onPick }: { answers: string[]; chosen: string | null; numbered: boolean; onPick: (a: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {answers.map((a, i) => (
        <button
          key={a}
          type="button"
          data-model-answer={a}
          aria-pressed={chosen === a}
          disabled={chosen !== null}
          onClick={() => onPick(a)}
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 text-left text-[16px] font-semibold",
            chosen === a ? "border-foreground" : "border-border",
            chosen !== null && chosen !== a && "opacity-35",
          )}
        >
          {numbered ? (
            <b aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[14px] text-background">{i + 1}</b>
          ) : null}
          {a}
        </button>
      ))}
    </div>
  );
}

function Question({ text, big }: { text: string | null | undefined; big: boolean }) {
  if (!text) return null;
  return big ? (
    <p data-model-question className="m-0 px-[17px] text-[18.5px] leading-[1.45]">{text}</p>
  ) : (
    <p data-model-question className="m-0 text-[16px] font-semibold">{text}</p>
  );
}

function footerFor(screen: TeachScreen, chosen: string | null, onPick: (a: string) => void, onSkip: () => void, onRecord?: () => void) {
  if (chosen !== null) return null;
  const skip = screen.answers.includes(W.skip) ? [{ label: W.skip, onClick: onSkip }] : [];
  if (screen.step === "words") {
    return <WalkFooter pill={{ label: W.record_answer, onClick: onRecord ?? (() => undefined), disabled: !onRecord }} dot links={skip} />;
  }
  const unclear = screen.answers.includes(W.audio_unclear) ? [{ label: W.audio_unclear, onClick: () => onPick(W.audio_unclear) }] : [];
  return skip.length || unclear.length ? <WalkFooter links={[...unclear, ...skip]} /> : null;
}

export function TeachStep({ screen, caption, content, note, chosen, onPick, onSkip, onBack, onClose, onRecordAnswer }: {
  screen: TeachScreen;
  caption: string;
  content: Record<string, unknown> | null | undefined;
  note: string | null;
  chosen: string | null;
  onPick: (answer: string) => void;
  onSkip: () => void;
  onBack: () => void;
  onClose: () => void;
  onRecordAnswer?: () => void;
}) {
  const judge = isJudge(screen);
  const choices = choicesOf(screen);
  return (
    <WalkOverlay
      onBack={onBack}
      backLabel={caption}
      title={screen.title ?? null}
      onClose={onClose}
      footer={footerFor(screen, chosen, onPick, onSkip, onRecordAnswer)}
      testId="model-teach"
    >
      <ExampleCase content={content} />
      <Question text={screen.question} big={!judge} />
      {note ? (
        <span data-model-note className="self-start rounded-full bg-[#E2F4EB] px-2.5 py-[3px] text-[12.5px] font-semibold text-[#1F7A55]">{note}</span>
      ) : null}
      {judge ? (
        <Faces answers={choices} chosen={chosen} onPick={onPick} />
      ) : screen.step === "words" ? null : (
        <Choices answers={choices} chosen={chosen} numbered={screen.step === "rate"} onPick={onPick} />
      )}
      {screen.source_note ? <p className="m-0 text-[14px] text-muted-foreground">{screen.source_note}</p> : null}
    </WalkOverlay>
  );
}

export function TrustScreen({ model, trust, onKeep, onList, onClose }: { model: string; trust: Trust; onKeep: () => void; onList: () => void; onClose: () => void }) {
  return (
    <WalkOverlay
      onBack={onList}
      backLabel={model}
      onClose={onClose}
      footer={<WalkFooter pill={{ label: trust.actions[0], onClick: onKeep }} links={[{ label: trust.actions[1], onClick: onList }]} />}
      testId="model-trust"
    >
      <p className="m-0 text-[15px] leading-snug">{trust.lines[0]}</p>
      {trust.lines.slice(1).map((line) => <WalkMessage key={line}>{line}</WalkMessage>)}
    </WalkOverlay>
  );
}

type Place = { index: number; step: number };
/** A follow-up question on the example just answered: it keeps that
 *  example's case, so the clip is not loaded again (MOD-17). */
type Pending = Follow & { content: TeachExample["content"]; exampleId: string };

function useTeachFlow(examples: TeachExample[] | null, models: Record<string, ModelInfo>, holdMs: number) {
  const [place, setPlace] = useState<Place>({ index: 0, step: 0 });
  const [follows, setFollows] = useState<Pending[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [trust, setTrust] = useState<{ model: string; trust: Trust } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  const example = examples?.[place.index] ?? null;
  const info = example ? models[example.model_id] : undefined;
  const follow = follows[0] ?? null;
  const screen: TeachScreen | null = follow
    ? { ...follow.screen, question: follow.line }
    : example
      ? teachScreen(info?.name ?? "", info?.recipe, example, place.step)
      : null;
  const content = follow ? follow.content : example?.content;
  /** On past the screen just shown: a follow-up goes; the main screen moves
   *  to its next step, or to the next example. */
  const advance = (wasFollow: boolean) => {
    setChosen(null);
    setNote(null);
    if (wasFollow) return setFollows((f) => f.slice(1));
    const steps = recipeSteps(info?.recipe);
    setPlace((p) => (p.step + 1 < steps.length ? { ...p, step: p.step + 1 } : { index: p.index + 1, step: 0 }));
  };
  const pick = async (answer: string) => {
    if (!screen || (!follow && !example)) return;
    const modelId = follow ? follow.model_id : example!.model_id;
    const exampleId = follow ? String(follow.screen.example?.id ?? follow.exampleId) : example!.id;
    setChosen(answer);
    const saved = await answerExample(modelId, exampleId, screen.step, answer);
    if (!saved) return setChosen(null);
    setNote(saved.note);
    const wasFollow = !!follow;
    const base = follow ? { content: follow.content, exampleId: follow.exampleId } : { content: example!.content, exampleId: example!.id };
    timer.current = window.setTimeout(() => {
      if (saved.follow.length) setFollows((f) => [...f, ...saved.follow.map((x) => ({ ...x, ...base }))]);
      advance(wasFollow);
      if (saved.trust) setTrust({ model: info?.name ?? "", trust: saved.trust });
    }, saved.note ? holdMs : 0);
  };
  return {
    screen,
    content,
    chosen,
    note,
    trust,
    place,
    done: examples !== null && !follow && !example,
    pick,
    skip: () => advance(!!follow),
    keep: () => setTrust(null),
  };
}

export default function ModelTeach({ only, onBack, onClose, onDone, onList, onRecordAnswer, holdMs = TEACH_HOLD_MS }: {
  /** One model alone (tapped in the queue, or come through its door), or null for the one queue. */
  only: string | null;
  onBack: () => void;
  onClose: () => void;
  /** Nothing more waits: back to the queue, which then says so. */
  onDone: () => void;
  /** "Back to the list". */
  onList: () => void;
  onRecordAnswer?: () => void;
  holdMs?: number;
}) {
  const { examples, models } = useTeachQueue(only);
  const flow = useTeachFlow(examples, models, holdMs);
  const finished = flow.done && !flow.trust;
  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);
  if (flow.trust) {
    return <TrustScreen model={flow.trust.model} trust={flow.trust.trust} onKeep={flow.keep} onList={onList} onClose={onClose} />;
  }
  if (!flow.screen || !examples) return null;
  return (
    <TeachStep
      screen={flow.screen}
      caption={teachCaption(flow.screen.model ?? "", Math.min(flow.place.index, examples.length - 1), examples.length)}
      content={flow.content}
      note={flow.note}
      chosen={flow.chosen}
      onPick={(a) => void flow.pick(a)}
      onSkip={flow.skip}
      onBack={onBack}
      onClose={onClose}
      onRecordAnswer={onRecordAnswer}
    />
  );
}
