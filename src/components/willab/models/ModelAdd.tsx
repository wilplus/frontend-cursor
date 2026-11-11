"use client";

import { useEffect, useRef, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import { addModelExample, answerExample, getModelPage, getQueue, type Recipe, type TeachExample } from "@/services/api/models";
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

/** A written case's words: a text file's own, the first 4,000 characters
 *  (the backend's MAX_ADDED_TEXT). Anything else gives none. */
async function wordsOf(file: File): Promise<string> {
  const written = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
  if (!written) return "";
  const read = await file.text().catch(() => "");
  return read.trim().slice(0, 4000);
}

export function AddExampleScreen({ onBack, onClose, onAdded, only = null }: Nav & {
  onAdded?: (added: Added) => void;
  /** One model alone (a host's new model, from the blank setup): no choice. */
  only?: string | null;
}) {
  const queue = useRead(() => getQueue(), "add");
  const models = only ? [] : queue?.models ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const modelId = only ?? chosen ?? models[0]?.id ?? null;
  const pick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const send = async (text: string) => {
    if (!text || !modelId || busy) return;
    setBusy(true);
    const made = await addModelExample(modelId, { text });
    setBusy(false);
    if (made) onAdded?.({ modelId, example: { id: made.exampleId, model_id: modelId, content: { text } } });
  };
  const add = async (file: File) => send(await wordsOf(file));
  const can = Boolean(onAdded && modelId);
  if (writing) {
    // The case is typed in Will's chat; his ask is the screen's own line.
    return (
      <div data-testid="models-add-write" className="absolute inset-0 z-10 flex flex-col bg-background">
        <Frame onBack={() => setWriting(false)}>
          <Say>{W.add_intro}</Say>
        </Frame>
        <Box placeholder={WILL.typeHere} onSend={(text) => void send(text.slice(0, 4000))} />
      </div>
    );
  }
  const ways = [
    { title: W.add_write, line: W.add_write_line, onClick: can ? () => setWriting(true) : undefined },
    { title: W.add_record, line: W.add_record_line, onClick: undefined },
    { title: W.add_upload, line: W.add_upload_line, onClick: can ? () => pick.current?.click() : undefined },
  ];
  return (
    <WalkOverlay onBack={onBack} backLabel={W.add_title} onClose={onClose} testId="models-add">
      <Said>{W.add_intro}</Said>
      {models.length > 1 ? (
        <>
          <p className="-mb-2 m-0 text-[14px] font-semibold text-muted-foreground">{TO_SIGN.forWhichModel}</p>
          {models.map((m) => (
            <Choice key={m.id} choice={{ key: m.id, title: m.name, line: "" }} check={m.id === modelId} on={m.id === modelId} onClick={() => setChosen(m.id)} />
          ))}
        </>
      ) : null}
      {ways.map((c) => (
        <button
          key={c.title}
          type="button"
          disabled={!c.onClick || busy}
          onClick={c.onClick}
          className="flex flex-col rounded-2xl border-[1.5px] border-border px-3.5 py-3 text-left disabled:cursor-default disabled:opacity-45"
        >
          <b className="text-[16px]">{c.title}</b>
          <span className="text-[16px] text-foreground">{c.line}</span>
        </button>
      ))}
      <input
        ref={pick}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        hidden
        data-model-add-file
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void add(file);
        }}
      />
      <Muted>{W.add_counts_once}</Muted>
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
