"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { PRICES, SEND, W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import { clearTalkDraft, publishTalkDraft, saveTalkDraft, talkBuilt, type TalkPlugin, type TalkSnap } from "@/lib/willab/chatBuilder/talkDraft";
import { transcribeAnswer } from "@/services/api/lifeGoals";

/* The chat, built by talking. Four steps, like a deck: Brief, Steps, Coach, Look.
   Each answer is a version. Undo puts that version back. Finishing writes a
   draft on this device, which the recording screens, Ideal Text and the walk read. */

const STEPS = ["Brief", "Steps", "Coach", "Look"] as const;
const SENDS: SendKind[] = ["rec", "text", "photo", "file"];
const WALKS = ["best", "fix", "words"] as const;
const OPENING: Line[] = [{ who: "will", text: "What do you do?", quotes: ["Speaking coach", "You decide"] }];
const COACH_HELLO = "Hi. Record a short talk, and I'll tell you what worked.";
const WRITTEN_PASTE = "# id: hedge\n# role: detector\n# interventionType: NOTICE\n# hears: hedging\n# step: walk.message\n";
const CHIPS: { id: string; label: string }[] = [
  { id: "rec", label: "Record" },
  { id: "text", label: "Type" },
  { id: "photo", label: "Photo" },
  { id: "file", label: "File" },
  { id: "machine", label: "Train" },
];

type Who = TalkSnap["who"];
type Phase = "brief" | "send" | "walk" | "who" | "pay" | "price" | "machine" | "connect" | "model" | "other" | "otherName" | "code" | "paste" | "plan" | "edit" | "greet" | "look" | "done";
type Snap = TalkSnap & { label: string };
type Line = { who: "will" | "me"; text: string; quotes?: string[] };
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

function planLine(snap: Snap): string {
  const hello = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  return `${snap.spec || "Your chat"}. First line: ${hello}`;
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
  const box = useRef<HTMLTextAreaElement>(null);
  const downAt = useRef(0);
  const live = useRef(false);
  const linesRef = useRef<Line[]>(OPENING);
  const snapRef = useRef<Snap>(blank());
  const phaseRef = useRef<Phase>("brief");
  const iRef = useRef(0);
  const priceRef = useRef(0);
  const versionsRef = useRef<Frame[]>([]);
  const priceBack = useRef<"machine" | "plan">("machine");

  const stepName = phase === "brief" ? "Brief" : phase === "plan" || phase === "edit" ? "Steps" : phase === "look" || phase === "done" ? "Look" : phase === "send" || phase === "walk" ? "Steps" : "Coach";
  const placeholder = phase === "brief" ? "Say what you do" : phase === "paste" ? "Paste the step" : phase === "greet" ? "The first line" : phase === "model" ? "Which one" : phase === "otherName" ? "Name the other one" : phase === "plan" ? "Say go" : phase === "edit" ? "What should change" : phase === "look" ? "Yes opens it" : "Yes or no";

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
    setSavedName(built.definition.name);
  };

  const onBrief = (text: string) => {
    if (/^just build it$/i.test(text.trim())) {
      express();
      return;
    }
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

  const express = () => {
    const cur = snapRef.current;
    const next: Snap = {
      ...cur,
      spec: cur.spec || "Speaking coach",
      send: cur.send.length ? cur.send : ["rec", "text"],
      walk: cur.walk.length ? cur.walk : ["best", "fix", "words"],
      who: cur.spec ? cur.who : "shadow",
      machine: cur.spec ? cur.machine : true,
    };
    write({
      snap: next, phase: "plan", i: 0,
      add: [{ who: "me", text: "Just build it" }, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }],
      label: "Plan v1",
    });
  };

  const onSend = async (text: string) => {
    const here = phaseRef.current;
    const yes = /^(yes|the first one|1)$/i.test(text.trim()) || (here === "plan" && /^(go|you decide)$/i.test(text.trim()));
    const no = /^no$/i.test(text.trim());
    const free = here === "model" || here === "paste" || here === "look" || here === "done" || here === "otherName" || here === "greet" || here === "edit";
    const said: Line[] = [];
    if (!free) {
      if (!yes && !no) {
        write({ add: [{ who: "will", text: "Yes or no." }] });
        return;
      }
      said.push({ who: "me", text: yes ? "Yes" : "No" });
    }
    const step = `v${versionsRef.current.length + 1}`;
    if (here === "send") {
      const kind = SENDS[iRef.current];
      let send = snapRef.current.send.filter((k) => k !== kind);
      if (yes) send = [...send, kind];
      if (iRef.current + 1 >= SENDS.length && !send.length) send = [kind];
      const next = { ...snapRef.current, send };
      const n = iRef.current + 1;
      if (n < SENDS.length) {
        write({ snap: next, phase: "send", i: n, add: [...said, { who: "will", text: W.sendOne(SEND[SENDS[n]][0]) }], label: `Send ${step}` });
        return;
      }
      if (next.send.includes("rec")) {
        write({ snap: next, phase: "walk", i: 0, add: [...said, { who: "will", text: W.walkOne(W.walkSteps.best) }], label: `Steps ${step}` });
      } else {
        write({ snap: next, phase: "who", i: 0, add: [...said, { who: "will", text: "Do you check each answer before it goes?" }], label: `Steps ${step}` });
      }
      return;
    }
    if (here === "walk") {
      const id = WALKS[iRef.current];
      let walk = snapRef.current.walk.filter((k) => k !== id);
      if (yes) walk = [...walk, id];
      if (iRef.current + 1 >= WALKS.length && !walk.length) walk = [id];
      const next = { ...snapRef.current, walk };
      if (iRef.current + 1 < WALKS.length) {
        const n = iRef.current + 1;
        write({ snap: next, phase: "walk", i: n, add: [...said, { who: "will", text: W.walkOne(W.walkSteps[WALKS[n]]) }], label: `Walk ${step}` });
        return;
      }
      write({ snap: next, phase: "who", i: 0, add: [...said, { who: "will", text: "Do you check each answer before it goes?" }], label: `Steps ${step}` });
      return;
    }
    if (here === "who") {
      if (iRef.current === 0 && !yes) {
        write({ phase: "who", i: 1, add: [...said, { who: "will", text: "Do you write every answer yourself?" }], label: `Who ${step}` });
        return;
      }
      const who: Who = iRef.current === 0 ? "shadow" : yes ? "you" : "assistant";
      write({ snap: { ...snapRef.current, who }, phase: "pay", add: [...said, { who: "will", text: "Do people pay to use it?" }], label: `Coach ${step}` });
      return;
    }
    if (here === "pay") {
      if (!yes) {
        write({ snap: { ...snapRef.current, pay: false, price: 0 }, phase: "machine", add: [...said, { who: "will", text: "Train it on your own answers?" }], label: `Pay ${step}` });
        return;
      }
      write({ snap: { ...snapRef.current, pay: true }, phase: "price", priceAt: 0, add: [...said, { who: "will", text: `Charge ${PRICES[0]}?` }], label: `Pay ${step}` });
      return;
    }
    if (here === "price" && priceBack.current === "plan") {
      const next = { ...snapRef.current, pay: yes, price: yes ? PRICES[0] : 0 };
      priceBack.current = "machine";
      write({ snap: next, phase: "plan", add: [...said, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }], label: `Edit ${step}` });
      return;
    }
    if (here === "price") {
      if (yes) {
        write({ snap: { ...snapRef.current, price: PRICES[priceRef.current] }, phase: "machine", add: [...said, { who: "will", text: "Train it on your own answers?" }], label: `Price ${step}` });
        return;
      }
      const n = priceRef.current + 1;
      if (n >= PRICES.length) {
        write({ snap: { ...snapRef.current, price: 0 }, phase: "machine", add: [...said, { who: "will", text: "Train it on your own answers?" }], label: `Price ${step}` });
        return;
      }
      write({ phase: "price", priceAt: n, add: [...said, { who: "will", text: `Charge ${PRICES[n]}?` }], label: `Price ${step}` });
      return;
    }
    if (here === "machine") {
      write({ snap: { ...snapRef.current, machine: yes }, phase: "connect", add: [...said, { who: "will", text: "Use a model that already exists?" }], label: `Train ${step}` });
      return;
    }
    if (here === "connect") {
      if (!yes) {
        write({ snap: { ...snapRef.current, connect: false, model: "", otherModels: [] }, phase: "code", add: [...said, { who: "will", text: "Will you add your own code later?" }], label: `Model ${step}` });
        return;
      }
      write({
        snap: { ...snapRef.current, connect: true }, phase: "model",
        add: [...said, { who: "will", text: models.length ? "Which one?" : "What should it notice?", quotes: models.map((m) => m.q) }],
        label: `Model ${step}`,
      });
      return;
    }
    if (here === "model") {
      const picked = models.length ? (/^the first one$/i.test(text.trim()) ? models[0] : models.find((m) => m.q === text.trim()) ?? models[0]) : null;
      const model = picked?.id ?? text.trim();
      write({
        snap: { ...snapRef.current, model }, phase: "other",
        add: [{ who: "me", text: picked?.q ?? model }, { who: "will", text: "Add another model?" }],
        label: `Model ${step}`,
      });
      return;
    }
    if (here === "other") {
      if (!yes) {
        write({ snap: { ...snapRef.current, otherModels: [] }, phase: "code", add: [...said, { who: "will", text: "Will you add your own code later?" }], label: `Model ${step}` });
        return;
      }
      write({ phase: "otherName", add: [...said, { who: "will", text: "What should the other one notice?" }], label: `Model ${step}` });
      return;
    }
    if (here === "otherName") {
      const name = text.trim();
      if (!name) {
        write({ add: [{ who: "will", text: "Name it." }] });
        return;
      }
      write({ snap: { ...snapRef.current, otherModels: [name] }, phase: "code", add: [{ who: "me", text: name }, { who: "will", text: "Will you add your own code later?" }], label: `Model ${step}` });
      return;
    }
    if (here === "code") {
      if (!yes) {
        const next = { ...snapRef.current, code: false, paste: "", plugin: null };
        write({ snap: next, phase: "plan", add: [...said, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }], label: `Plan ${step}` });
        return;
      }
      write({ snap: { ...snapRef.current, code: true }, phase: "paste", add: [...said, { who: "will", text: "Paste the step, then send it.", quotes: ["Write this for me"] }], label: `Code ${step}` });
      return;
    }
    if (here === "paste") {
      const source = /^write this for me$/i.test(text.trim()) ? WRITTEN_PASTE : text;
      const checked = await checkPlugin(source);
      if (checked.status !== "checked" || !checked.manifest) {
        write({ add: [{ who: "will", text: "That step is missing its name. Paste another.", quotes: ["Write this for me"] }] });
        return;
      }
      const plugin: TalkPlugin = { id: checked.manifest.id, hash: checked.hash, interventionType: checked.manifest.interventionType as TalkPlugin["interventionType"] };
      const next = { ...snapRef.current, code: true, paste: source, plugin };
      write({ snap: next, phase: "plan", add: [{ who: "me", text: "Pasted." }, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }], label: `Plan ${step}` });
      return;
    }
    if (here === "plan") {
      if (yes) {
        finish(snapRef.current, [...said, { who: "will", text: "This is the chat.", quotes: ["Open the list", "Try it out loud"] }], `Look ${step}`);
        return;
      }
      write({ phase: "edit", add: [...said, { who: "will", text: "What should change?", quotes: ["The greeting", "The price"] }], label: `Plan ${step}` });
      return;
    }
    if (here === "edit") {
      const lower = text.trim().toLowerCase();
      if (/greeting|first line/.test(lower)) {
        write({ phase: "greet", add: [{ who: "me", text: text.trim() }, { who: "will", text: "What is the first line?", quotes: ["Write this for me"] }], label: `Edit ${step}` });
        return;
      }
      if (/price|pay/.test(lower)) {
        priceBack.current = "plan";
        write({ phase: "price", priceAt: 0, add: [{ who: "me", text: text.trim() }, { who: "will", text: `Charge ${PRICES[0]}?` }], label: `Edit ${step}` });
        return;
      }
      write({ add: [{ who: "will", text: "Say the greeting or the price.", quotes: ["The greeting", "The price"] }] });
      return;
    }
    if (here === "greet") {
      const hello = /^write this for me$/i.test(text.trim()) ? (snapRef.current.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.") : text.trim();
      const next = { ...snapRef.current, hello };
      write({ snap: next, phase: "plan", add: [{ who: "me", text: hello }, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }], label: `Edit ${step}` });
      return;
    }
    if (here === "look") {
      if (/list|open/i.test(text)) return onList();
      write({ phase: "done", add: [{ who: "me", text: text.trim() }, { who: "will", text: "This is the chat.", quotes: ["Open the list", "Try it out loud"] }], label: `Done ${step}` });
    }
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
      box.current?.focus();
    }
  };

  const take = (text: string) => {
    if (/^done$/i.test(text.trim()) && phaseRef.current !== "brief") {
      const next = snapRef.current;
      write({ phase: "done", add: [{ who: "me", text: "done" }, { who: "will", text: "This is the chat.", quotes: ["Open the list", "Try it out loud"] }], label: "Done" });
      if (next.spec) {
        saveTalkDraft(talkBuilt(next));
        setSavedName(talkBuilt(next).definition.name);
      }
      return;
    }
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
      if (snapRef.current.spec) saveTalkDraft(talkBuilt(copySnap(snapRef.current)));
      else clearTalkDraft();
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

  const shown = versions.at(-1)?.label ?? "";
  const choice = !["brief", "look", "done", "paste", "model", "otherName", "greet", "edit"].includes(phase);
  const helloLine = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");

  return (
    <div data-talk-build="" data-talk-phase={phase} data-talk-saved={savedName || undefined} data-talk-snap={JSON.stringify({ spec: snap.spec, send: snap.send, walk: snap.walk, who: snap.who, pay: snap.pay, price: snap.price, machine: snap.machine, connect: snap.connect, code: snap.code, model: snap.model, otherModels: snap.otherModels, paste: snap.paste, hello: snap.hello })} className="flex min-h-0 flex-1 flex-col bg-background">
      <div data-talk-steps="" className="flex min-h-11 shrink-0 items-center gap-1.5 border-b border-border px-4 text-[12.5px]" aria-label="Progress">
        {STEPS.map((name, n) => (
          <span key={name} className="flex items-center gap-1.5">
            {n > 0 ? <i className="block h-px w-2.5 bg-[#d4d4d4]" aria-hidden /> : null}
            <span data-talk-step={name} className={name === stepName ? "font-semibold text-foreground" : "font-medium text-[#a3a3a3]"}>{name}</span>
          </span>
        ))}
        <button type="button" data-talk-undo="" className="ml-auto inline-flex min-h-11 min-w-11 items-center rounded-full bg-muted px-3 text-[12.5px] font-medium disabled:opacity-40" onClick={undo} disabled={!versions.length}>Undo{shown ? `: ${shown}` : ""}</button>
      </div>
      <div className="px-4 pt-2">
        <button type="button" data-express="" className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-border px-3 text-[15px] font-medium" onClick={express}>Just build it</button>
      </div>
      {shown ? <p data-talk-version="" className="mx-4 mt-3 flex min-h-8 items-center rounded-2xl border border-border px-3 text-[14px] font-semibold">{shown}</p> : null}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {lines.map((line, n) => (
          <div key={n} className={line.who === "me" ? "max-w-[86%] self-end rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] text-primary-foreground" : "max-w-[86%] self-start rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]"}>
            <p className="m-0">{line.text}</p>
            {line.quotes?.map((q) => (
              <button key={q} type="button" data-quote="" data-say={q} className="mx-0.5 inline-flex min-h-11 min-w-11 items-center rounded-[7px] bg-[#fff1e8] px-2 text-left font-semibold text-[#c84d06]" onClick={() => setDraft(q === "Write this for me" ? (phase === "paste" ? WRITTEN_PASTE : (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.")) : q)}>“{q}”</button>
            ))}
          </div>
        ))}
        {choice ? (
          <div className="flex gap-2">
            <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={() => take("No")}>No</button>
            <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => take("Yes")}>Yes</button>
          </div>
        ) : null}
        {snap.walk.length > 1 ? (
          <ol data-talk-order="" className="m-0 flex list-none flex-col gap-2 p-0">
            {snap.walk.map((raw) => {
              const id = raw as typeof WALKS[number];
              return (
              <li key={id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain") as typeof id; const walk = snap.walk.filter((k) => k !== from); const at = walk.indexOf(id); walk.splice(at, 0, from); const next = { ...snap, walk }; snapRef.current = next; setSnap(next); }} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border px-3">
                <span className="text-[15px]">{W.walkSteps[id]}</span>
                <button type="button" data-move="earlier" aria-label={`Earlier ${W.walkSteps[id]}`} className="ml-auto min-h-11 min-w-11 px-2" onClick={() => move(id, -1)}>Earlier</button>
                <button type="button" data-move="later" aria-label={`Later ${W.walkSteps[id]}`} className="min-h-11 min-w-11 px-2" onClick={() => move(id, 1)}>Later</button>
              </li>
              );
            })}
          </ol>
        ) : null}
        {phase === "look" || phase === "done" ? (
          <div data-talk-preview="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <p data-talk-greeting="" className="m-0 text-[16px]">{helloLine}</p>
            <div className="flex gap-2">
              <button type="button" data-preview-keep="" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => setKept(true)}>Keep</button>
              <button type="button" data-preview-next="" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={onList}>Next</button>
            </div>
            <button type="button" data-talk-publish="" className="min-h-11 rounded-full border border-border text-[15px] font-semibold" onClick={() => { publishTalkDraft(); setLiveDraft(true); }}>Publish</button>
            {kept ? <p data-talk-kept="" className="m-0 text-[15px]">Kept.</p> : null}
            {liveDraft ? <p data-talk-live="" className="m-0 text-[15px]">Live on this device.</p> : null}
          </div>
        ) : null}
        {phase === "done" ? (
          <div data-talk-result="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <p className="m-0 text-[16px] font-semibold">{snap.spec || "Your chat"}</p>
            <button type="button" className="min-h-11 rounded-full bg-foreground text-[15px] font-semibold text-background" onClick={onList}>Open the list</button>
            <button type="button" className="min-h-11 rounded-full border border-border text-[15px] font-semibold" onClick={() => write({ add: [{ who: "will", text: snap.spec === "Speaking coach" ? "Hi. Record a short talk, and I'll tell you what worked." : "Say the first thing people should hear." }] })}>Try it out loud</button>
          </div>
        ) : null}
      </div>
      {phase !== "brief" ? (
        <div data-talk-chips="" className="flex flex-wrap gap-2 px-4 pb-2">
          {CHIPS.map((chip) => {
            const on = chip.id === "machine" ? snap.machine : snap.send.includes(chip.id as SendKind);
            return (
              <button key={chip.id} type="button" data-chip={chip.id} aria-pressed={on} className={`inline-flex min-h-11 min-w-11 items-center rounded-full border px-3 text-[15px] font-medium ${on ? "border-primary bg-[#fff1e8] text-[#c84d06]" : "border-border"}`} onClick={() => {
                const cur = snapRef.current;
                if (chip.id === "machine") {
                  write({ snap: { ...cur, machine: !cur.machine }, label: "Chip" });
                  return;
                }
                const kind = chip.id as SendKind;
                const has = cur.send.includes(kind);
                const send = has ? cur.send.filter((k) => k !== kind) : [...cur.send, kind];
                write({ snap: { ...cur, send: send.length ? send : cur.send }, label: "Chip" });
              }}>{chip.label}</button>
            );
          })}
        </div>
      ) : null}
      {(phase === "paste" || phase === "greet") ? (
        <div className="flex gap-2 px-4 pb-2">
          <button type="button" data-write-for-me="" className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-[#fff1e8] px-3 text-[15px] font-semibold text-[#c84d06]" onClick={() => setDraft(phase === "paste" ? WRITTEN_PASTE : (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready."))}>Write this for me</button>
          {draft ? <button type="button" data-write-keep="" className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-3 text-[15px] font-medium text-primary-foreground" onClick={() => { const text = draft; setDraft(""); take(text); }}>Keep</button> : null}
          {draft ? <button type="button" data-rewrite="" className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-border px-3 text-[15px] font-medium" onClick={() => setDraft("")}>Rewrite</button> : null}
        </div>
      ) : null}
      <form data-talk-composer="" className={`mx-4 mb-3 flex items-end gap-1.5 rounded-[28px] border bg-background p-1.5 shadow-[0_8px_30px_rgba(20,20,30,.07)] ${recording ? "border-[rgba(229,56,59,.45)]" : "border-border"}`} onSubmit={(e) => { e.preventDefault(); const text = draft.trim(); if (!text) return; setDraft(""); take(text); }}>
        <button type="button" aria-label="Speak" data-talk-mic="" data-recording={recording ? "" : undefined} className={`flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-full ${recording ? "bg-[#e5383b] text-white" : "bg-muted text-foreground"}`} onPointerDown={(e) => { e.preventDefault(); downAt.current = Date.now(); void onMic(); }} onPointerUp={() => { if (live.current && Date.now() - downAt.current >= 280) void onMic(); }}>
          <Mic className="h-5 w-5" aria-hidden />
        </button>
        <textarea ref={box} value={draft} rows={1} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="max-h-28 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-[16px] leading-[22px] outline-none placeholder:text-[#a3a3a3]" />
        <button type="submit" aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-white disabled:bg-[#e5e5e5]" disabled={!draft.trim()}>Send</button>
      </form>
      <button type="button" data-talk-list="" className="min-h-11 border-t border-border text-[15px] font-semibold" onClick={onList}>See the list</button>
    </div>
  );
}
