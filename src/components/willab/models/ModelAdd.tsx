"use client";

import { useEffect, useRef, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import {
  addExampleSet,
  addModelExample,
  answerExample,
  getModelPage,
  getQueue,
  readComing,
  wantComing,
  type ComingKind,
  type Recipe,
  type TeachExample,
} from "@/services/api/models";
import { useRead } from "./ModelScreens";
import { TeachStep } from "./ModelTeach";
import { MODELS_WORDS as W, TO_SIGN } from "./modelsCopy";
import { Choice, Muted, Said } from "./SetupParts";
import { recipeSteps, teachScreen } from "./teachSteps";
import { Box, Frame, Say } from "../chats/hostsetup/SetupBits";
import { W as WILL } from "../chats/hostsetup/hostSetupCopy";

/* -------------------------------------------------------------------------- */
/*  "Add an example you know well" (backend N563 item 4, N566 item 6; App     */
/*  Model MOD-21; the locked prototype's q:7): which model, then the case in  */
/*  words, then the adder answers it on the teachers' own screen. It counts   */
/*  once another teacher agrees (the backend's note says so after the last    */
/*  answer). A case is written in Will's chat ("Write one", N638) or comes    */
/*  from a text file's words; "Record one" waits for a recording path that   */
/*  hands a model a transcript (no route yet), so it is drawn lighter and     */
/*  cannot be tapped (N638 item 2, N637 item 1).                              */
/* -------------------------------------------------------------------------- */

type Nav = { onBack?: () => void; onClose: () => void };
export type Added = { modelId: string; example: TeachExample };

/** A text file's words, the whole of it; anything else gives none. */
async function textOf(file: File): Promise<string> {
  const written = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
  if (!written) return "";
  return (await file.text().catch(() => "")).trim();
}

/** The cases a set of texts makes (N645 item 4): several files, one case
 *  per file; one file, one case per line that is not empty. Each is cut to
 *  the backend's 4,000 characters, and one call takes the first 200 (the
 *  rest wait; nothing is said about it). Pure. */
export function casesOf(texts: string[]): string[] {
  const words = texts.map((t) => t.trim()).filter(Boolean);
  const cases = words.length === 1 ? words[0].split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : words;
  return cases.map((c) => c.slice(0, MAX_CASE)).slice(0, MAX_SET);
}
const MAX_CASE = 4000;
const MAX_SET = 200;

type View = "ways" | "write" | "set" | "texts";

function Way({ title, line, onClick, busy = false }: { title: string; line?: string; onClick?: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={!onClick || busy}
      onClick={onClick}
      className="flex flex-col rounded-2xl border-[1.5px] border-border px-3.5 py-3 text-left disabled:cursor-default disabled:opacity-45"
    >
      <b className="text-[16px]">{title}</b>
      {line ? <span className="text-[16px] text-foreground">{line}</span> : null}
    </button>
  );
}

/** "Upload a set" asks what kind (N645 item 3): texts, and the two kinds
 *  coming, each with "I want this" that tells the founder once (the walk's
 *  pattern, N641). The coming rows show only once their read answers. */
function SetKinds({ onTexts }: { onTexts: () => void }) {
  const [coming, setComing] = useState<{ kind: ComingKind; wanted: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void readComing().then((got) => {
      if (alive) setComing(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  const want = (kind: ComingKind) => {
    if (busy) return;
    setBusy(true);
    void wantComing(kind).then((told) => {
      setBusy(false);
      if (told) setComing((was) => (was ?? []).map((c) => (c.kind === kind ? { ...c, wanted: true } : c)));
    });
  };
  return (
    <>
      <Way title={W.set_texts} onClick={onTexts} />
      {(coming ?? []).map((c) => (
        <Way
          key={c.kind}
          title={`${W.set_coming[c.kind]} ${c.wanted ? W.set_told : W.set_want}`}
          busy={busy}
          onClick={c.wanted ? undefined : () => want(c.kind)}
        />
      ))}
    </>
  );
}

/** "Texts": the line, the files, and "I may use these." without which
 *  nothing is taken (N645 item 4). "Upload a set" opens the picker. */
function SetTexts({ busy, onCases }: { busy: boolean; onCases: (cases: string[]) => void }) {
  const [may, setMay] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <>
      <Said>{W.set_texts_line}</Said>
      <Choice choice={{ key: "may", title: W.set_may_use, line: "" }} check={may} on={may} onClick={() => setMay(!may)} />
      <Way title={W.add_set} busy={busy} onClick={may ? () => pick.current?.click() : undefined} />
      <input
        ref={pick}
        type="file"
        multiple
        accept=".txt,.md,text/plain,text/markdown"
        hidden
        data-model-add-files
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          void Promise.all(files.map(textOf)).then((texts) => {
            const cases = casesOf(texts);
            if (cases.length) onCases(cases);
          });
        }}
      />
    </>
  );
}

export function AddExampleScreen({ onBack, onClose, onAdded, onSet, only = null }: Nav & {
  onAdded?: (added: Added) => void;
  /** A set was taken for this model: its answering opens. */
  onSet?: (modelId: string) => void;
  /** One model alone (a host's new model, from the blank setup): no choice. */
  only?: string | null;
}) {
  const queue = useRead(() => getQueue(), "add");
  const models = only ? [] : queue?.models ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const modelId = only ?? chosen ?? models[0]?.id ?? null;
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("ways");
  const send = async (text: string) => {
    if (!text || !modelId || busy) return;
    setBusy(true);
    const made = await addModelExample(modelId, { text });
    setBusy(false);
    if (made) onAdded?.({ modelId, example: { id: made.exampleId, model_id: modelId, content: { text } } });
  };
  const sendSet = async (cases: string[]) => {
    if (!modelId || busy) return;
    setBusy(true);
    const got = await addExampleSet(modelId, cases);
    setBusy(false);
    if (got && got.added > 0) onSet?.(modelId);
  };
  if (view === "write") {
    // The case is typed in Will's chat; his ask is the screen's own line.
    return (
      <div data-testid="models-add-write" className="absolute inset-0 z-10 flex flex-col bg-background">
        <Frame onBack={() => setView("ways")}>
          <Say>{W.add_intro}</Say>
        </Frame>
        <Box placeholder={WILL.typeHere} onSend={(text) => void send(text.slice(0, MAX_CASE))} />
      </div>
    );
  }
  if (view === "set" || view === "texts") {
    return (
      <WalkOverlay onBack={() => setView(view === "texts" ? "set" : "ways")} backLabel={W.add_title} onClose={onClose} testId="models-add-set">
        {view === "set" ? <SetKinds onTexts={() => setView("texts")} /> : <SetTexts busy={busy} onCases={(cases) => void sendSet(cases)} />}
      </WalkOverlay>
    );
  }
  const can = Boolean(onAdded && modelId);
  return (
    <WalkOverlay onBack={onBack} backLabel={W.add_title} onClose={onClose} testId="models-add">
      {W.add_guide.map((line) => <Said key={line}>{line}</Said>)}
      {models.length > 1 ? (
        <>
          <p className="-mb-2 m-0 text-[16px] font-semibold text-foreground">{TO_SIGN.forWhichModel}</p>
          {models.map((m) => (
            <Choice key={m.id} choice={{ key: m.id, title: m.name, line: "" }} check={m.id === modelId} on={m.id === modelId} onClick={() => setChosen(m.id)} />
          ))}
        </>
      ) : null}
      <Way title={W.add_write} line={W.add_write_line} busy={busy} onClick={can ? () => setView("write") : undefined} />
      <Way title={W.add_set} busy={busy} onClick={onSet && modelId ? () => setView("set") : undefined} />
      <Way title={W.add_record} line={W.add_record_line} />
    </WalkOverlay>
  );
}

/** The adder answers their own example, step by step on the teachers'
 *  screen; then the backend's note, and back to the queue. */
export function AnswerAdded({ added, onBack, onClose, onDone }: Nav & { added: Added; onDone: () => void }) {
  const [model, setModel] = useState<{ name: string; recipe: Recipe | undefined } | null>(null);
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getModelPage(added.modelId).then((page) => {
      if (alive) setModel({ name: page?.name ?? "", recipe: page?.recipe });
    });
    return () => {
      alive = false;
    };
  }, [added.modelId]);
  if (!model) return null;
  const steps = recipeSteps(model.recipe);
  if (note !== null || step >= steps.length) {
    return (
      <WalkOverlay onBack={onBack} backLabel={W.add_title} onClose={onClose} footer={<WalkFooter pill={{ label: W.keep_teaching, onClick: onDone }} />} testId="models-added">
        <Said>{note || W.add_counts_once}</Said>
      </WalkOverlay>
    );
  }
  const screen = teachScreen(model.name, model.recipe, added.example, step);
  const next = (saidNote: string | null) => {
    setChosen(null);
    if (step + 1 < steps.length) setStep(step + 1);
    else setNote(saidNote ?? "");
  };
  return (
    <TeachStep
      screen={screen}
      caption={W.add_title}
      content={added.example.content}
      note={null}
      chosen={chosen}
      onPick={(a) => {
        setChosen(a);
        void answerExample(added.modelId, added.example.id, screen.step, a).then((saved) => (saved ? next(saved.note) : setChosen(null)));
      }}
      onSkip={() => next(null)}
      onBack={onBack ?? onClose}
      onClose={onClose}
    />
  );
}
