"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { BarBox, ChatBarRow } from "@/components/willab/chats/ChatBar";
import { PRICES, SEND, W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import { clearTalkDraft, markTalkReady, publishTalkDraft, saveTalkDraft, talkBuilt } from "@/lib/willab/chatBuilder/talkDraft";
import { transcribeAnswer } from "@/services/api/lifeGoals";
import { COACH_HELLO, SENDS, speakTurn, WALKS, WRITTEN_PASTE, type Line, type Phase, type Snap } from "./talkTurn";
import ChatIconPicker from "./ChatIconPicker";

/* The chat, built by talking. Four steps, like a deck: Brief, Steps, Coach, Look.
   Each answer is a version. Undo puts that version back. Finishing writes a
   draft on this device, which the recording screens, Ideal Text and the walk read. */

const STEPS = ["Brief", "Steps", "Coach", "Look"] as const;
const OPENING: Line[] = [{ who: "will", text: "What do you do?", quotes: ["Speaking coach", "You decide"] }];
const CHIPS: { id: string; label: string }[] = [
  { id: "rec", label: "Record" },
  { id: "text", label: "Type" },
  { id: "photo", label: "Photo" },
  { id: "file", label: "File" },
  { id: "machine", label: "Train" },
];

type Frame = { snap: Snap; phase: Phase; i: number; priceAt: number; lines: Line[]; label: string };

const blank = (): Snap => ({
  label: "Brief v0", spec: "", send: [], walk: [], who: "shadow", pay: false, machine: false, code: false, connect: false, price: 0, model: "", otherModels: [], paste: "", plugin: null, hello: "",
});

function hear(onText: (said: string) => void) {
  const w = window as unknown as { SpeechRecognition?: new () => { start: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null }; webkitSpeechRecognition?: new () => { start: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null } };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return false;
  const rec = new Ctor();
  rec.onresult = (e) => onText(e.results[0][0].transcript);
  rec.start();
  return true;
}

function copySnap(snap: Snap): Snap {
  return { ...snap, send: [...snap.send], walk: [...snap.walk], otherModels: [...snap.otherModels] };
}

function stepLabel(phase: Phase): string {
  if (phase === "brief") return "Brief";
  if (phase === "look" || phase === "done") return "Look";
  if (phase === "plan" || phase === "edit" || phase === "send" || phase === "walk") return "Steps";
  return "Coach";
}

function hintFor(phase: Phase): string {
  if (phase === "brief") return "Say what you do";
  if (phase === "paste") return W.codePaste;
  if (phase === "greet") return "The first line";
  if (phase === "model") return "Which one";
  if (phase === "otherName") return "Name the other one";
  if (phase === "plan") return "Say go";
  if (phase === "edit") return "What should change";
  if (phase === "look") return "Yes opens it";
  return "Yes or no";
}

function generatedDraft(phase: Phase, spec: string): string {
  if (phase === "paste") return WRITTEN_PASTE;
  return spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.";
}

function TalkProgress({ phase, versions, onUndo }: {
  phase: Phase;
  versions: { label: string }[];
  onUndo: () => void;
}) {
  const stepName = stepLabel(phase);
  const shown = versions.at(-1)?.label ?? "";
  return (
    <>
      <div data-talk-steps="" className="flex min-h-11 shrink-0 items-center gap-1.5 border-b border-border px-4 text-[12.5px]" aria-label="Progress">
        {STEPS.map((name, n) => (
          <span key={name} className="flex items-center gap-1.5">
            {n > 0 ? <i className="block h-px w-2.5 bg-[#d4d4d4]" aria-hidden /> : null}
            <span data-talk-step={name} className={name === stepName ? "font-semibold text-foreground" : "font-medium text-[#a3a3a3]"}>{name}</span>
          </span>
        ))}
        <button type="button" data-talk-undo="" className="ml-auto inline-flex min-h-11 min-w-11 items-center rounded-full bg-muted px-3 text-[12.5px] font-medium disabled:opacity-40" onClick={onUndo} disabled={!versions.length}>Undo{shown ? `: ${shown}` : ""}</button>
      </div>
      {shown ? <p data-talk-version="" className="mx-4 mt-3 flex min-h-8 items-center rounded-2xl border border-border px-3 text-[14px] font-semibold">{shown}</p> : null}
    </>
  );
}

function TalkThread({ phase, lines, snap, kept, liveDraft, onTake, onMove, onReorder, onList, onKeep, onPublish, onTry, setDraft }: {
  phase: Phase;
  lines: Line[];
  snap: Snap;
  kept: boolean;
  liveDraft: boolean;
  onTake: (text: string) => void;
  onMove: (id: typeof WALKS[number], dir: -1 | 1) => void;
  onReorder: (from: string, onto: typeof WALKS[number]) => void;
  onList: () => void;
  onKeep: () => void;
  onPublish: () => void;
  onTry: () => void;
  setDraft: (value: string) => void;
}) {
  const choice = !["brief", "look", "done", "paste", "model", "otherName", "greet", "edit"].includes(phase);
  const helloLine = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  return (
    <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-4">
      {lines.map((line, n) => (
        <div key={n} className={line.who === "me" ? "max-w-[86%] min-w-0 self-end break-words rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] text-primary-foreground" : "max-w-[86%] min-w-0 self-start break-words rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]"}>
          <p className="m-0">{line.text}</p>
          {line.quotes?.map((q) => (
            <button key={q} type="button" data-quote="" data-say={q} className="mx-0.5 inline-flex min-h-11 min-w-11 items-center rounded-[7px] bg-[#fff1e8] px-2 text-left font-semibold text-[#c84d06]" onClick={() => setDraft(q === "Write this for me" ? generatedDraft(phase, snap.spec) : q)}>“{q}”</button>
          ))}
        </div>
      ))}
      {choice ? (
        <div className="flex gap-2">
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={() => onTake("No")}>No</button>
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => onTake("Yes")}>Yes</button>
        </div>
      ) : null}
      {snap.walk.length > 1 ? (
        <ol data-talk-order="" className="m-0 flex list-none flex-col gap-2 p-0">
          {snap.walk.map((raw) => {
            const id = raw as typeof WALKS[number];
            return (
              <li key={id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onReorder(e.dataTransfer.getData("text/plain"), id); }} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border px-3">
                <span className="text-[15px]">{W.walkSteps[id]}</span>
                <button type="button" data-move="earlier" aria-label={`Earlier ${W.walkSteps[id]}`} className="ml-auto min-h-11 min-w-11 px-2" onClick={() => onMove(id, -1)}>Earlier</button>
                <button type="button" data-move="later" aria-label={`Later ${W.walkSteps[id]}`} className="min-h-11 min-w-11 px-2" onClick={() => onMove(id, 1)}>Later</button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {phase === "look" || phase === "done" ? (
        <div data-talk-preview="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
          <p data-talk-greeting="" className="m-0 text-[16px]">{helloLine}</p>
          <ChatIconPicker name={snap.spec || "Your chat"} />
          <div className="flex gap-2">
            <button type="button" data-preview-keep="" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={onKeep}>Keep</button>
            <button type="button" data-preview-next="" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={onList}>Next</button>
          </div>
          <button type="button" data-talk-publish="" className="min-h-11 rounded-full border border-border text-[15px] font-semibold" onClick={onPublish}>Publish</button>
          {kept ? <p data-talk-kept="" className="m-0 text-[15px]">Kept.</p> : null}
          {liveDraft ? <p data-talk-live="" className="m-0 text-[15px]">Live on this device.</p> : null}
        </div>
      ) : null}
      {phase === "done" ? (
        <div data-talk-result="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
          <p className="m-0 text-[16px] font-semibold">{snap.spec || "Your chat"}</p>
          <button type="button" className="min-h-11 rounded-full bg-foreground text-[15px] font-semibold text-background" onClick={onList}>Open the list</button>
          <button type="button" className="min-h-11 rounded-full border border-border text-[15px] font-semibold" onClick={onTry}>Try it out loud</button>
        </div>
      ) : null}
    </div>
  );
}

function TalkTools({ phase, snap, draft, onChip, onTake, setDraft }: {
  phase: Phase;
  snap: Snap;
  draft: string;
  onChip: (id: string) => void;
  onTake: (text: string) => void;
  setDraft: (value: string) => void;
}) {
  return (
    <>
      {phase !== "brief" ? (
        <div data-talk-chips="" className="flex flex-wrap gap-2 px-4 pb-2">
          {CHIPS.map((chip) => {
            const on = chip.id === "machine" ? snap.machine : snap.send.includes(chip.id as SendKind);
            return (
              <button key={chip.id} type="button" data-chip={chip.id} aria-pressed={on} className={`inline-flex min-h-11 min-w-11 items-center rounded-full border px-3 text-[15px] font-medium ${on ? "border-primary bg-[#fff1e8] text-[#c84d06]" : "border-border"}`} onClick={() => onChip(chip.id)}>{chip.label}</button>
            );
          })}
        </div>
      ) : null}
      {(phase === "paste" || phase === "greet") ? (
        <div className="flex gap-2 px-4 pb-2">
          <button type="button" data-write-for-me="" className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-[#fff1e8] px-3 text-[15px] font-semibold text-[#c84d06]" onClick={() => setDraft(generatedDraft(phase, snap.spec))}>Write this for me</button>
          {draft ? <button type="button" data-write-keep="" className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-3 text-[15px] font-medium text-primary-foreground" onClick={() => { const text = draft; setDraft(""); onTake(text); }}>Keep</button> : null}
          {draft ? <button type="button" data-rewrite="" className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-border px-3 text-[15px] font-medium" onClick={() => setDraft("")}>Rewrite</button> : null}
        </div>
      ) : null}
    </>
  );
}

export default function TalkBuild({ onList, models = [], transcribe = transcribeAnswer }: {
  onList: () => void;
  /** Models already on the account. A tap picks one. */
  models?: { id: string; q: string }[];
  /** Words from a recording, when the browser cannot listen itself. */
  transcribe?: (audio: Blob) => Promise<string | null>;
}) {
  const [snap, setSnap] = useState<Snap>(blank());
  const [versions, setVersions] = useState<Frame[]>([]);
  const [lines, setLines] = useState<Line[]>(OPENING);
  const [phase, setPhase] = useState<Phase>("brief");
  const [priceAt, setPriceAt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [kept, setKept] = useState(false);
  const [liveDraft, setLiveDraft] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState("");
  const downAt = useRef(0);
  const live = useRef(false);
  const linesRef = useRef<Line[]>(OPENING);
  const snapRef = useRef<Snap>(blank());
  const phaseRef = useRef<Phase>("brief");
  const iRef = useRef(0);
  const priceRef = useRef(0);
  const versionsRef = useRef<Frame[]>([]);
  const priceBack = useRef<"machine" | "plan">("machine");

  const placeholder = hintFor(phase);

  const write = (next: { snap?: Snap; phase?: Phase; i?: number; priceAt?: number; add?: Line[]; label?: string }) => {
    if (next.add?.length) linesRef.current = [...linesRef.current, ...next.add];
    if (next.snap) snapRef.current = next.snap;
    if (next.phase) phaseRef.current = next.phase;
    if (next.i !== undefined) iRef.current = next.i;
    if (next.priceAt !== undefined) priceRef.current = next.priceAt;
    setLines(linesRef.current);
    setSnap(snapRef.current);
    setPhase(phaseRef.current);
    setI(iRef.current);
    setPriceAt(priceRef.current);
    if (!next.label) return;
    const frame: Frame = {
      snap: copySnap(snapRef.current),
      phase: phaseRef.current,
      i: iRef.current,
      priceAt: priceRef.current,
      lines: linesRef.current.slice(),
      label: next.label,
    };
    versionsRef.current = [...versionsRef.current, frame];
    setVersions(versionsRef.current);
    saveTalkDraft(talkBuilt(copySnap(snapRef.current)));
  };

  const finish = (next: Snap, add: Line[], label: string) => {
    write({ snap: next, phase: "look", i: 0, add, label });
    const built = talkBuilt(snapRef.current);
    saveTalkDraft(built);
    markTalkReady(true);
    setSavedName(built.definition.name);
  };

  const onBrief = (text: string) => {
    const spec = /first one|^1$|speaking coach|^you decide$/i.test(text) ? "Speaking coach" : text.trim();
    if (!spec || /^something else$/i.test(spec)) {
      write({ add: [{ who: "will", text: "Say it in your own words." }] });
      return;
    }
    const next = { ...snapRef.current, spec };
    write({
      snap: next, phase: "send", i: 0,
      add: [{ who: "me", text: spec }, { who: "will", text: W.sendOne(SEND[SENDS[0]][0]) }],
      label: "Brief v1",
    });
  };

  const onSend = async (text: string) => {
    await speakTurn({
      text, phase: phaseRef.current, yes: false, no: false, said: [],
      step: `v${versionsRef.current.length + 1}`,
      snap: snapRef.current, i: iRef.current, priceAt: priceRef.current,
      models, priceBack, write, finish, onList,
    });
  };

  const onMic = async () => {
    if (live.current) {
      live.current = false;
      setRecording(false);
      stopRec.current?.();
      stopRec.current = null;
      return;
    }
    live.current = true;
    setRecording(true);
    if (hear((said) => { live.current = false; setRecording(false); take(said); })) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const rec = new MediaRecorder(stream);
      const bits: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) bits.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(bits, { type: rec.mimeType || "audio/webm" });
        void transcribe(blob).then((got) => { if (got) take(got); });
      };
      rec.start();
      stopRec.current = () => rec.stop();
    } catch {
      live.current = false;
      setRecording(false);
      document.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")?.focus();
    }
  };

  const take = (text: string) => {
    if (phaseRef.current === "brief") onBrief(text);
    else void onSend(text);
  };

  const undo = () => {
    const prev = versionsRef.current.slice(0, -1);
    versionsRef.current = prev;
    const back = prev.at(-1);
    if (!back) {
      linesRef.current = OPENING.map((line) => ({ ...line, quotes: line.quotes?.slice() }));
      snapRef.current = blank();
      phaseRef.current = "brief";
      iRef.current = 0;
      priceRef.current = 0;
    } else {
      linesRef.current = back.lines.map((line) => ({ ...line, quotes: line.quotes?.slice() }));
      snapRef.current = copySnap(back.snap);
      phaseRef.current = back.phase;
      iRef.current = back.i;
      priceRef.current = back.priceAt;
    }
    setLines(linesRef.current);
    setSnap(snapRef.current);
    setPhase(phaseRef.current);
    setI(iRef.current);
    setPriceAt(priceRef.current);
    setVersions(prev);
    if (phaseRef.current !== "look" && phaseRef.current !== "done") {
      setSavedName("");
      if (snapRef.current.spec) {
        saveTalkDraft(talkBuilt(copySnap(snapRef.current)));
        markTalkReady(false);
      } else clearTalkDraft();
    }
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
      write({ snap: { ...cur, machine: !cur.machine }, label: "Chip" });
      return;
    }
    const kind = id as SendKind;
    const has = cur.send.includes(kind);
    const send = has ? cur.send.filter((k) => k !== kind) : [...cur.send, kind];
    write({ snap: { ...cur, send: send.length ? send : cur.send }, label: "Chip" });
  };

  return (
    <div data-talk-build="" data-talk-phase={phase} data-talk-saved={savedName || undefined} data-talk-snap={JSON.stringify({ spec: snap.spec, send: snap.send, walk: snap.walk, who: snap.who, pay: snap.pay, price: snap.price, machine: snap.machine, connect: snap.connect, code: snap.code, model: snap.model, otherModels: snap.otherModels, paste: snap.paste, hello: snap.hello })} className="flex min-h-0 flex-1 flex-col bg-background">
      <TalkProgress phase={phase} versions={versions} onUndo={undo} />
      <TalkThread
        phase={phase} lines={lines} snap={snap} kept={kept} liveDraft={liveDraft}
        onTake={take} onMove={move} onReorder={reorder} onList={onList}
        onKeep={() => setKept(true)} onPublish={() => { publishTalkDraft(); setLiveDraft(true); }}
        onTry={() => write({ add: [{ who: "will", text: snap.spec === "Speaking coach" ? "Hi. Record a short talk, and I'll tell you what worked." : "Say the first thing people should hear." }] })}
        setDraft={setDraft}
      />
      <TalkTools phase={phase} snap={snap} draft={draft} onChip={onChip} onTake={take} setDraft={setDraft} />
      <ChatBarRow flush={false} data-talk-composer="">
        <button type="button" aria-label="Speak" data-talk-mic="" data-recording={recording ? "" : undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground" onPointerDown={(e) => { e.preventDefault(); downAt.current = Date.now(); void onMic(); }} onPointerUp={() => { if (live.current && Date.now() - downAt.current >= 280) void onMic(); }}>
          <Mic className="h-5 w-5" aria-hidden />
        </button>
        <BarBox
          key={draft}
          hint={placeholder}
          open
          grow
          initial={draft}
          onSend={async (words) => { setDraft(""); take(words); return true; }}
        />
      </ChatBarRow>
      <button type="button" data-talk-list="" className="min-h-11 border-t border-border pb-[env(safe-area-inset-bottom)] text-[15px] font-semibold" onClick={onList}>See the list</button>
    </div>
  );
}
