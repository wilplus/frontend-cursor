"use client";

import { TapRow } from "../../WillQuestion";
import { W } from "./hostSetupCopy";
import { Card, Frame, Mine, Opt, Say, type SetupDockSpec } from "./SetupBits";

/** How a person meets this model in the host's chat: the question, the
 *  answers as taps, and one sample tap. The line under it is who teaches
 *  it: the host's own answers, not the person's message. */
export function ModelPreview({ question, answers }: { question: string; answers: string[] }) {
  const sample = answers[0] ?? "";
  return (
    <div data-model-preview="" className="flex flex-col gap-2 rounded-2xl border border-border px-3 py-3">
      {question ? <Say>{question}</Say> : null}
      {answers.length ? (
        <TapRow even labels={answers} onTap={() => undefined} dataAttr={{ "data-model-preview-answers": "" }} />
      ) : null}
      {sample ? <div data-model-sample=""><Mine>{sample}</Mine></div> : null}
      <p data-model-taught="" className="m-0 text-[15px] text-foreground">{W.learningLine}</p>
    </div>
  );
}

const card = "flex w-full items-start rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-left text-[16px] font-semibold text-foreground disabled:opacity-45";

function choiceDock(labels: string[], onChoice: (label: string) => void, extra: Partial<SetupDockSpec> = {}): SetupDockSpec {
  return { onSend: () => false, ...extra, choices: labels, onChoice };
}

/* -------------------------------------------------------------------------- */
/*  A model made in blocks, one choice per screen (backend N636 item 6,       */
/*  N637; the pinned prototype's steps ownwhy, gives, base and stack). The    */
/*  same screens in the chat setup (HostSetup) and on the AI models page      */
/*  (ModelBlocks, N636 item 7): one way to start a model.                     */
/* -------------------------------------------------------------------------- */

export type BlockKey = "model" | "gives" | "base";

/** One's own answers as typed (N646): one on each line, empty lines and
 *  repeats (any case) left out, the first three, each at most 24
 *  characters; fewer than two is none. Pure. */
export function answersOf(typed: string): string[] {
  const seen = new Set<string>();
  const lines = typed.split(/\r?\n/).map((l) => l.trim().slice(0, 24)).filter((l) => {
    const k = l.toLowerCase();
    if (!l || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return lines.length >= 2 ? lines.slice(0, 3) : [];
}

/** The sets for a question with a first one known (a suggested model's own
 *  answers): it first, then the backend's others. Pure. */
export function withFirst(first: string[] | null, sets: string[][]): string[][] {
  if (!first) return sets;
  const key = (s: string[]) => s.join("\n").toLowerCase();
  return [first, ...sets.filter((s) => key(s) !== key(first))];
}

/** "People answer with:" (N646): the answers as one card. Draw new one shows
 *  the next set. Typed lines, two or three, are one's own. */
export function AnswersScreen({ onBack, answers, onKeep, onChange, onOwn }: {
  onBack: () => void;
  answers: string[];
  onKeep: () => void;
  onChange: () => void;
  /** One's own answers, already split. False: fewer than two, the words stay. */
  onOwn: (typed: string) => void | boolean;
}) {
  return (
    <Frame
      onBack={onBack}
      dock={choiceDock([W.drawNew, W.keep], (label) => (label === W.keep ? onKeep() : onChange()), {
        onSend: onOwn,
        placeholder: W.writeHere,
        lines: true,
      })}
    >
      <Say>{W.answersSay}</Say>
      <Say>{W.answersAsk}</Say>
      <div data-model-answers="">
        <Card b={answers.join(" · ")} />
      </div>
    </Frame>
  );
}

/** Why one's own model: two lines, then "Not now" or "Train my own". */
export function OwnWhyScreen({ onBack, onNo, onYes }: { onBack: () => void; onNo: () => void; onYes: () => void }) {
  return (
    <Frame onBack={onBack} dock={choiceDock([W.notNow, W.trainMyOwn], (label) => (label === W.trainMyOwn ? onYes() : onNo()))}>
      {W.ownSay.map((line) => <Say key={line}>{line}</Say>)}
    </Frame>
  );
}

const GIVES_READY = new Set(["pick", "words"]);

/** "What should it give back?": a pick, or an answer in the host's words. */
export function GivesScreen({ onBack, on, onPick }: { onBack: () => void; on: string | null; onPick: (id: string) => void }) {
  return (
    <Frame onBack={onBack} dock={choiceDock(W.gives.filter(([id]) => GIVES_READY.has(id)).map(([, title]) => title), (label) => {
      const hit = W.gives.find(([, title]) => title === label);
      if (hit && GIVES_READY.has(hit[0])) onPick(hit[0]);
    })}>
      <Say>{W.givesSay}</Say>
      {W.gives.map(([id, title]) => (
        <Opt key={id} title={title} on={on === id} disabled={!GIVES_READY.has(id)} onClick={() => { if (GIVES_READY.has(id)) onPick(id); }} />
      ))}
    </Frame>
  );
}

/** "What should it be built on?": only GPT taps (N634 item 1). */
export function BaseScreen({ onBack, on, onPick }: { onBack: () => void; on: string | null; onPick: (id: string) => void }) {
  return (
    <Frame onBack={onBack} dock={choiceDock(W.bases.filter(([id]) => id === "gpt").map(([, title]) => title), (label) => {
      const hit = W.bases.find(([, title]) => title === label);
      if (hit) onPick(hit[0]);
    })}>
      <Say>{W.baseSay}</Say>
      {W.bases.map(([id, title]) => (
        <Opt key={id} title={title} on={on === id} disabled={id !== "gpt"} onClick={() => onPick(id)} />
      ))}
    </Frame>
  );
}

export const BLOCK = card;

/** "Your model. Tap a block to change it.": four dark blocks; the question,
 *  what it gives back and what it is built on each open their one choice. */
export function BlocksScreen({ onBack, q, gives, answers = [], onOpen, onTeach, onTaught, taughtOpen = false, busy = false }: {
  onBack: () => void;
  q: string;
  gives: string | null;
  /** The answers a person taps, as the preview shows them. */
  answers?: string[];
  onOpen: (block: BlockKey) => void;
  onTeach: () => void;
  /** The taught-by block. The card stores no choice of who else teaches. */
  onTaught?: () => void;
  taughtOpen?: boolean;
  busy?: boolean;
}) {
  const title = W.gives.find(([id]) => id === (gives ?? "pick"))?.[1] ?? W.gives[0][1];
  return (
    <Frame onBack={onBack} dock={choiceDock([W.teachIt], () => onTeach(), { disabled: busy })}>
      <Say>{W.stackSay}</Say>
      <div data-model-stack="" className="flex flex-col gap-2">
        <button type="button" className={BLOCK} onClick={() => onOpen("model")}>{q}</button>
        <button type="button" className={BLOCK} onClick={() => onOpen("gives")}>{W.givesBlock(title)}</button>
        <button type="button" className={BLOCK} onClick={() => onOpen("base")}>{W.builtOnGpt}</button>
        <button type="button" className={BLOCK} onClick={onTaught}>{W.taughtByYou}</button>
      </div>
      {taughtOpen ? <Say>{W.learningLine}</Say> : null}
      <ModelPreview question={q} answers={answers} />
    </Frame>
  );
}
