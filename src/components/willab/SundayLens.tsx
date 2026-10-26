"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import { SUNDAY_COPY as COPY } from "@/lib/willab/sundayNote";
import { answerSundayNote, getSundayNote, type SundayNote } from "@/services/api/voiceNotebook";
import {
  Closed,
  DockColumn,
  EditorDock,
  FIELD,
  LensFrame,
  TapsDock,
  script,
  type Item,
  type Script,
} from "./LoungeLifeGoals";
import WalkStage from "./walk/WalkStage";
import { WalkLink, WalkPill } from "./walk/WalkFooter";

/* -------------------------------------------------------------------------- */
/*  The Sunday note as a lens (Will learning plan, step 2; backend N158,       */
/*  N170; rules docs/flows/principles.md §1 L; prototype                       */
/*  https://claude.ai/artifact/Bt2YEZLKhu9fLTA1deWTvo).                        */
/*                                                                            */
/*  The walk's frame with the bar "‹ Sunday note ›" and ✕ (L3). Every          */
/*  question and answer is a row of the one Lounge thread, written by the      */
/*  backend: the lens replays the rows so far, then asks the step it waits on  */
/*  (L4 the bug, L5 the principle held, L6 the reflection, L7 the new          */
/*  principle), so it reopens where it stands (L8).                            */
/* -------------------------------------------------------------------------- */

/** The bugs as the judgement's tall answers, then "Add a new bug" with a +
 *  on the right (L4). A tapped bug fills black and holds before it lands. */
function BugDock({ onPick, onAdd }: { onPick: (key: string) => void; onAdd: () => void }) {
  const [held, setHeld] = useState<string | null>(null);
  const tall = "walk-press walk-fill flex min-h-[72px] items-center rounded-2xl border-[1.5px] px-[22px] text-left text-[21px]";
  return (
    <DockColumn>
      {COPY.bugs.map((bug) => (
        <button
          key={bug.key}
          type="button"
          disabled={held !== null}
          onClick={() => {
            setHeld(bug.key);
            setTimeout(() => onPick(bug.key), WALK_ANSWER_HOLD_MS);
          }}
          className={cn(
            tall,
            "gap-[18px] font-semibold",
            held === bug.key ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
          )}
        >
          <span aria-hidden="true" className="text-[30px] leading-none">
            {bug.emoji}
          </span>
          {bug.label}
        </button>
      ))}
      <button
        type="button"
        disabled={held !== null}
        onClick={onAdd}
        className={cn(tall, "justify-between border-border bg-background font-medium text-muted-foreground")}
      >
        {COPY.addBug}
        <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-border text-[20px] text-foreground">
          +
        </span>
      </button>
    </DockColumn>
  );
}

/** A field; Next once there are words, and Skip (L6). */
function ReflectionDock({ onAnswer }: { onAnswer: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <DockColumn>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} />
      <WalkPill action={{ label: COPY.next, onClick: () => onAnswer(text.trim()), disabled: !text.trim() }} />
      <WalkLink action={{ label: COPY.skip, onClick: () => onAnswer("") }} />
    </DockColumn>
  );
}

/** A one-line field, Add and Back (the new bug's name, L4). */
function NameDock({ onAdd, onBack }: { onAdd: (name: string) => void; onBack: () => void }) {
  const [text, setText] = useState("");
  return (
    <DockColumn>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={COPY.nameBug}
        aria-label={COPY.nameBug}
        className={FIELD}
        autoFocus
      />
      <WalkPill action={{ label: COPY.add, onClick: () => onAdd(text.trim()), disabled: !text.trim() }} />
      <WalkLink action={{ label: COPY.back, onClick: onBack }} />
    </DockColumn>
  );
}

type Answer = { value: unknown } | null;

async function askBug(s: Script): Promise<Answer> {
  for (;;) {
    const picked = await s.ask<string | null>((done) => <BugDock onPick={done} onAdd={() => done(null)} />);
    if (picked) return { value: picked };
    const name = await s.ask<string | null>((done) => <NameDock onAdd={done} onBack={() => done(null)} />);
    if (name) return { value: name };
  }
}

async function askApplied(s: Script, note: SundayNote): Promise<Answer> {
  const options = [...note.likely.map((p) => ({ emoji: "⚜️", label: p.title })), { label: COPY.noneYet }];
  const index = await s.ask<number>((done) => <TapsDock options={options} onPick={done} />);
  return { value: note.likely[index]?.id ?? "none" };
}

async function askPrinciple(s: Script, note: SundayNote): Promise<Answer> {
  for (;;) {
    const choice = await s.ask<"accept" | "edit" | "not_now">((done) => (
      <DockColumn>
        <WalkPill action={{ label: COPY.accept, onClick: () => done("accept") }} />
        <WalkPill outline action={{ label: COPY.edit, onClick: () => done("edit") }} />
        <WalkLink action={{ label: COPY.notNow, onClick: () => done("not_now") }} />
      </DockColumn>
    ));
    if (choice !== "edit") return { value: choice };
    const text = await s.ask<string | null>((done) => (
      <EditorDock value={note.new_principle ?? ""} label={COPY.addPrinciple} onKeep={done} onBack={() => done(null)} />
    ));
    if (text) return { value: { choice: "edit", text } };
  }
}

/** Will's rows land behind the dots; the speaker's as the orange bubble. */
async function show(s: Script, rows: SundayNote["rows"]): Promise<void> {
  for (const row of rows) {
    if (row.role === "user") await s.me(row.body);
    else await s.say(row.body);
  }
}

async function walk(s: Script, noteId: string, head: ReactNode[]): Promise<void> {
  let note = await getSundayNote(noteId);
  if (!note) return;
  s.fast.current = true;
  await s.say(...head, note.case);
  await show(s, note.rows);
  s.fast.current = false;
  if (note.step === "bug" && !note.rows.some((row) => row.step === "open")) {
    const opened = await answerSundayNote(noteId, "open");
    if (!opened) return;
    await show(s, opened.rows.slice(note.rows.length));
    note = opened;
  }
  while (note && ["bug", "applied", "reflection", "principle"].includes(note.step)) {
    const answer =
      note.step === "bug"
        ? await askBug(s)
        : note.step === "applied"
          ? await askApplied(s, note)
          : note.step === "reflection"
            ? { value: await s.ask<string>((done) => <ReflectionDock onAnswer={done} />) }
            : await askPrinciple(s, note);
    if (!answer) return;
    const next = await answerSundayNote(noteId, note.step, answer.value);
    if (!next) return;
    await show(s, next.rows.slice(note.rows.length));
    note = next;
  }
}

/** The lens over the Lounge, opened on one note; ``onClose`` reads the
 *  thread again, where the same rows now are (L8). */
export default function SundayLens({ noteId, nonce, onClose }: { noteId: string | null; nonce: number; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<ReactNode>(null);
  const run = useRef(0);
  const seq = useRef(0);
  const fast = useRef(false);

  useEffect(() => {
    if (!noteId) return;
    const id = ++run.current;
    setItems([]);
    setTyping(false);
    setDock(null);
    const s = script({
      add: (who, node) => run.current === id && setItems((now) => [...now, { id: ++seq.current, who, node }]),
      typing: (on) => run.current === id && setTyping(on),
      dock: (node) => run.current === id && setDock(node),
      alive: () => run.current === id,
      fast,
    });
    const close = <DockColumn><WalkPill action={{ label: COPY.close, onClick: onClose }} /></DockColumn>;
    void walk(s, noteId, [COPY.head])
      .then(() => run.current === id && setDock(close))
      .catch((error: unknown) => {
        if (!(error instanceof Closed) && run.current === id) setDock(close);
      });
    return () => {
      run.current += 1;
    };
    // One run per opening (its nonce).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, nonce]);

  return (
    <div data-feedback-walk>
      <WalkStage
        screen={{ key: "sunday-note", overlay: Boolean(noteId) }}
        render={(_screen, ghost) => (
          <LensFrame label={COPY.bar} items={items} typing={!ghost && typing} dock={ghost ? null : dock} onClose={onClose} />
        )}
      />
    </div>
  );
}

/** The "We spotted a pattern!" bubble in the Lounge: a › that opens the
 *  lens again where it stands, and the orange outline while it waits (L8). */
export function SundayHeadBubble({ body, waiting, onOpen }: { body: string; waiting: boolean; onOpen: () => void }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        data-sunday-head
        className={cn(
          "relative rounded-[16px] bg-muted px-3 py-2 pr-8 text-left text-[15px] leading-[1.45] text-foreground",
          waiting && "ring-2 ring-primary",
        )}
      >
        {body}
        <span aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[19px] text-muted-foreground">
          ›
        </span>
      </button>
    </div>
  );
}
