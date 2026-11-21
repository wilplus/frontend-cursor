"use client";

import { useEffect, useRef, useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import { BarBox, ChatBarRow } from "@/components/willab/chats/ChatBar";
import { SEND, W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { clearTalkDraft, markTalkReady, publishTalkDraft, saveTalkDraft, talkBuilt } from "@/lib/willab/chatBuilder/talkDraft";
import { COACH_HELLO, editEffect, SENDS, speakTurn, WALKS, WRITTEN_PASTE, type Line, type Phase, type Snap } from "./talkTurn";

/* The chat, built by talking. One question at a time, in the same bubbles as
   every other chat. Taps sit above the box. A tap on an earlier answer opens
   that question again. The list of answers is Settings, not this screen. */

const JOBS = ["Speaking coach", "ML specialist", "Neurobiologist", "Someone else"];
const OPENING: Line[] = [{ who: "will", text: "What do you do?" }];
const YESNO = new Set<Phase>(["send", "walk", "who", "pay", "price", "machine", "connect", "code", "other", "plan"]);

const blank = (): Snap => ({
  label: "", spec: "", send: [], walk: [], who: "shadow", pay: false, machine: false, code: false, connect: false, price: 0, model: "", otherModels: [], paste: "", plugin: null, hello: "",
});

function copySnap(snap: Snap): Snap {
  return { ...snap, send: [...snap.send], walk: [...snap.walk], otherModels: [...snap.otherModels] };
}

function hintFor(phase: Phase): string {
  if (phase === "brief") return "Say what you do";
  if (phase === "paste") return W.codePaste;
  if (phase === "describe") return W.codeDescribe;
  if (phase === "codeWay" || phase === "codeKeep") return W.codeHow;
  if (phase === "greet") return "The first line";
  if (phase === "model") return "Which one";
  if (phase === "otherName") return "Name the other one";
  if (phase === "plan") return "Say go";
  if (phase === "edit") return "What should change";
  if (phase === "look") return "Yes opens it";
  return "Yes or no";
}

function generatedDraft(phase: string, spec: string): string {
  if (phase === "paste") return WRITTEN_PASTE;
  return spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.";
}

function replyLabels(phase: string, models: { q: string }[], draft: string): string[] {
  if (phase === "brief") return JOBS;
  if (phase === "codeWay") return [W.codeTell, W.codeOwn];
  if (phase === "codeKeep") return [W.codeChange, W.codeKeep];
  if (phase === "model") return models.map((m) => m.q);
  if (phase === "paste" || phase === "greet") return draft ? ["Write this for me", "Keep", "Rewrite"] : ["Write this for me"];
  if (phase === "edit") return ["The greeting", "The price"];
  if (phase === "look" || phase === "done") return ["Keep", "Publish", "Try it out loud"];
  if (YESNO.has(phase as Phase)) return ["No", "Yes"];
  return [];
}

const WILL = "mr-auto max-w-[88%] whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground";
const MINE = "ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-left text-[15px] text-primary-foreground";

export default function TalkBuild({ onList, models = [] }: {
  onList: () => void;
  /** Models already on the account. A tap picks one. */
  models?: { id: string; q: string }[];
}) {
  const [snap, setSnap] = useState<Snap>(blank());
  const [lines, setLines] = useState<Line[]>(OPENING);
  const [phase, setPhase] = useState<Phase>("brief");
  const [, setPriceAt] = useState(0);
  const [savedName, setSavedName] = useState("");
  const [kept, setKept] = useState(false);
  const [liveDraft, setLiveDraft] = useState(false);
  const [, setI] = useState(0);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>(OPENING);
  const snapRef = useRef<Snap>(blank());
  const phaseRef = useRef<Phase>("brief");
  const iRef = useRef(0);
  const priceRef = useRef(0);
  const priceBack = useRef<"machine" | "plan">("machine");
  const editingRef = useRef<number | null>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, phase]);

  const placeholder = hintFor(editing !== null ? ((lines[editing]?.q as Phase) || phase) : phase);
  const asking = editing !== null ? (lines[editing]?.q || phase) : phase;
  const labels = replyLabels(asking, models, draft);

  const write = (next: { snap?: Snap; phase?: Phase; i?: number; priceAt?: number; add?: Line[]; label?: string }) => {
    const prior = copySnap(snapRef.current);
    if (next.add?.length) {
      const stamped = next.add.map((line) => (line.who === "me" && !line.before ? { ...line, before: prior } : line));
      linesRef.current = [...linesRef.current, ...stamped];
    }
    if (next.snap) snapRef.current = next.snap;
    if (next.phase) phaseRef.current = next.phase;
    if (next.i !== undefined) iRef.current = next.i;
    if (next.priceAt !== undefined) priceRef.current = next.priceAt;
    setLines(linesRef.current);
    setSnap(snapRef.current);
    setPhase(phaseRef.current);
    setI(iRef.current);
    setPriceAt(priceRef.current);
    if (snapRef.current.spec) saveTalkDraft(talkBuilt(copySnap(snapRef.current)));
  };

  const finish = (next: Snap, add: Line[], label: string) => {
    write({ snap: next, phase: "look", i: 0, add, label });
    const built = talkBuilt(snapRef.current);
    saveTalkDraft(built);
    markTalkReady(true);
    setSavedName(built.definition.name);
  };

  const onBrief = (text: string) => {
    const spec = /speaking coach/i.test(text) ? "Speaking coach" : text.trim();
    if (!spec || /^someone else$/i.test(spec)) {
      write({ add: [{ who: "will", text: "Say it in your own words." }] });
      return;
    }
    const next = { ...snapRef.current, spec };
    write({
      snap: next, phase: "send", i: 0,
      add: [{ who: "me", text: spec, q: "brief" }, { who: "will", text: W.sendOne(SEND[SENDS[0]][0]) }],
    });
  };

  const onSend = async (text: string) => {
    await speakTurn({
      text, phase: phaseRef.current, yes: false, no: false, said: [],
      step: "v",
      snap: snapRef.current, i: iRef.current, priceAt: priceRef.current,
      models, priceBack, write, finish, onList,
    });
  };

  const take = (text: string) => {
    if (phaseRef.current === "brief") onBrief(text);
    else void onSend(text);
  };

  const onEdit = (index: number, text: string) => {
    const line = linesRef.current[index];
    if (!line?.q) return;
    const yesNo = YESNO.has(line.q as Phase);
    if (yesNo && !/^(yes|no|the first one|1)$/i.test(text.trim())) {
      write({ add: [{ who: "will", text: W.talkYesNo }] });
      return;
    }
    const effect = editEffect(line, text, snapRef.current);
    editingRef.current = null;
    setEditing(null);
    if (effect.irrelevant && line.before) {
      linesRef.current = linesRef.current.slice(0, index);
      snapRef.current = copySnap(line.before);
      phaseRef.current = line.q as Phase;
      iRef.current = line.at ?? 0;
      setLines(linesRef.current);
      setSnap(snapRef.current);
      setPhase(phaseRef.current);
      setI(iRef.current);
      take(effect.answer);
      return;
    }
    const nextLines = linesRef.current.map((row, n) => (n === index ? { ...row, text: effect.answer } : row));
    linesRef.current = nextLines;
    snapRef.current = effect.snap;
    setLines(nextLines);
    setSnap(effect.snap);
    if (effect.snap.spec) saveTalkDraft(talkBuilt(copySnap(effect.snap)));
    else clearTalkDraft();
  };

  const submit = (text: string) => {
    if (editingRef.current !== null) onEdit(editingRef.current, text);
    else take(text);
  };

  const onReply = (label: string) => {
    const q = asking;
    if (label === "Someone else" && q === "brief") {
      document.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")?.focus();
      return;
    }
    if (label === "Write this for me") {
      setDraft(generatedDraft(q, snap.spec));
      return;
    }
    if (label === "Rewrite") {
      setDraft("");
      return;
    }
    if (label === "Keep" && (q === "paste" || q === "greet") && draft) {
      const text = draft;
      setDraft("");
      submit(text);
      return;
    }
    if (label === "Keep") {
      setKept(true);
      return;
    }
    if (label === "Publish") {
      publishTalkDraft();
      setLiveDraft(true);
      return;
    }
    if (label === "Try it out loud") {
      write({ add: [{ who: "will", text: snap.spec === "Speaking coach" ? "Hi. Record a short talk, and I'll tell you what worked." : "Say the first thing people should hear." }] });
      return;
    }
    submit(label);
  };

  const move = (id: typeof WALKS[number], dir: -1 | 1) => {
    const at = snap.walk.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= snap.walk.length) return;
    const walk = [...snap.walk];
    const [row] = walk.splice(at, 1);
    walk.splice(to, 0, row);
    const next = { ...snap, walk };
    snapRef.current = next;
    setSnap(next);
  };

  const reorder = (from: string, onto: typeof WALKS[number]) => {
    const walk = snap.walk.filter((k) => k !== from);
    const at = walk.indexOf(onto);
    walk.splice(at, 0, from as typeof WALKS[number]);
    const next = { ...snap, walk };
    snapRef.current = next;
    setSnap(next);
  };

  const onChip = (id: string) => {
    const cur = snapRef.current;
    if (id === "machine") {
      write({ snap: { ...cur, machine: !cur.machine } });
      return;
    }
    const kind = id as SendKind;
    const has = cur.send.includes(kind);
    const send = has ? cur.send.filter((k) => k !== kind) : [...cur.send, kind];
    write({ snap: { ...cur, send: send.length ? send : cur.send } });
  };

  const helloLine = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  const openEdit = (index: number) => {
    editingRef.current = index;
    setEditing(index);
  };

  return (
    <div data-talk-build="" data-talk-phase={phase} data-talk-saved={savedName || undefined} data-talk-snap={JSON.stringify({ spec: snap.spec, send: snap.send, walk: snap.walk, who: snap.who, pay: snap.pay, price: snap.price, machine: snap.machine, connect: snap.connect, code: snap.code, model: snap.model, otherModels: snap.otherModels, paste: snap.paste, hello: snap.hello })} className="flex min-h-0 flex-1 flex-col bg-background">
      <div ref={threadRef} className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-4">
        {lines.map((line, n) => line.who === "me" ? (
          <div
            key={n}
            role="button"
            tabIndex={0}
            data-my-answer=""
            data-answer-q={line.q}
            data-editing={editing === n ? "" : undefined}
            aria-label="Change this answer"
            className={MINE}
            onClick={() => openEdit(n)}
            onKeyDown={(e) => { if (e.key === "Enter") openEdit(n); }}
          >
            {line.text}
          </div>
        ) : (
          <div key={n} data-row="app" className="mr-auto flex max-w-[88%]">
            <div data-bubble="" className={WILL}>{line.text}</div>
          </div>
        ))}
        {snap.walk.length > 1 ? (
          <ol data-talk-order="" className="m-0 flex list-none flex-col gap-2 p-0">
            {snap.walk.map((raw) => {
              const id = raw as typeof WALKS[number];
              return (
                <li key={id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); reorder(e.dataTransfer.getData("text/plain"), id); }} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border px-3">
                  <span className="text-[15px]">{W.walkSteps[id]}</span>
                  <button type="button" data-move="earlier" aria-label={`Earlier ${W.walkSteps[id]}`} className="ml-auto min-h-11 min-w-11 px-2" onClick={() => move(id, -1)}>Earlier</button>
                  <button type="button" data-move="later" aria-label={`Later ${W.walkSteps[id]}`} className="min-h-11 min-w-11 px-2" onClick={() => move(id, 1)}>Later</button>
                </li>
              );
            })}
          </ol>
        ) : null}
        {phase === "look" || phase === "done" ? (
          <div data-row="app" className="mr-auto flex max-w-[88%]">
            <div data-bubble="" data-talk-greeting="" className={WILL}>{helloLine}</div>
          </div>
        ) : null}
        {kept ? <div data-row="app" className="mr-auto flex max-w-[88%]"><div data-talk-kept="" className={WILL}>Kept.</div></div> : null}
        {liveDraft ? <div data-row="app" className="mr-auto flex max-w-[88%]"><div data-talk-live="" className={WILL}>Live on this device.</div></div> : null}
      </div>
      {phase !== "brief" && editing === null ? (
        <div data-talk-chips="" className="flex flex-wrap justify-end gap-2 px-3 pb-1">
          {[["rec", "Record"], ["text", "Type"], ["photo", "Photo"], ["file", "File"], ["machine", "Train"]].map(([id, label]) => {
            const on = id === "machine" ? snap.machine : snap.send.includes(id as SendKind);
            return (
              <button key={id} type="button" data-chip={id} aria-pressed={on} className={`inline-flex min-h-11 min-w-11 items-center rounded-full border px-3 text-[15px] font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} onClick={() => onChip(id)}>{label}</button>
            );
          })}
        </div>
      ) : null}
      {labels.length ? (
        <div className="px-3 pb-1">
          <TapRow labels={labels} even={labels.length !== 2} onTap={onReply} dataAttr={{ "data-talk-replies": "" }} />
        </div>
      ) : null}
      <ChatBarRow data-talk-composer="">
        <BarBox
          key={draft}
          hint={placeholder}
          open
          grow
          initial={draft}
          onSend={async (words) => { setDraft(""); submit(words); return true; }}
        />
      </ChatBarRow>
    </div>
  );
}
