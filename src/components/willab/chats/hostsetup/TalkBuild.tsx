"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { PRICES, SEND, W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import { transcribeAnswer } from "@/services/api/lifeGoals";

/* The chat, built by talking. Four steps, like a deck: Brief, Steps, Coach, Look.
   Each answer is a version. Undo puts that version back. The list of parts
   stays one tap away. */

const STEPS = ["Brief", "Steps", "Coach", "Look"] as const;
const SENDS: SendKind[] = ["rec", "text", "photo", "file"];
const WALKS = ["best", "fix", "words"] as const;

type Who = "shadow" | "you" | "assistant";
type Snap = {
  label: string;
  spec: string;
  send: SendKind[];
  walk: typeof WALKS[number][];
  who: Who;
  pay: boolean;
  machine: boolean;
  code: boolean;
  connect: boolean;
  price: number;
  model: string;
  paste: string;
};
type Line = { who: "will" | "me"; text: string; quotes?: string[] };

const empty = (): Snap => ({
  label: "Brief v0", spec: "", send: [], walk: [], who: "shadow", pay: false, machine: false, code: false, connect: false, price: 0, model: "", paste: "",
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

export default function TalkBuild({ onList, models = [], transcribe = transcribeAnswer }: {
  onList: () => void;
  /** Models already on the account. A tap picks one. */
  models?: { id: string; q: string }[];
  /** Words from a recording, when the browser cannot listen itself. */
  transcribe?: (audio: Blob) => Promise<string | null>;
}) {
  const [snap, setSnap] = useState<Snap>(empty());
  const [versions, setVersions] = useState<Snap[]>([]);
  const [lines, setLines] = useState<Line[]>([{ who: "will", text: "What do you do?", quotes: ["Speaking coach", "Something else"] }]);
  const [phase, setPhase] = useState<"brief" | "send" | "walk" | "who" | "pay" | "price" | "machine" | "connect" | "model" | "code" | "paste" | "look" | "done">("brief");
  const [priceAt, setPriceAt] = useState(0);
  const [recording, setRecording] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const downAt = useRef(0);
  const live = useRef(false);

  const stepName = phase === "brief" ? "Brief" : phase === "send" || phase === "walk" ? "Steps" : phase === "look" || phase === "done" ? "Look" : "Coach";
  const placeholder = phase === "brief" ? "Say what you do" : phase === "paste" ? "Paste the step" : phase === "model" ? "Which one" : phase === "look" ? "Yes opens it" : "Yes or no";

  const say = (text: string, quotes?: string[]) => setLines((was) => [...was, { who: "will", text, quotes }]);
  const mine = (text: string) => setLines((was) => [...was, { who: "me", text }]);
  const keep = (next: Snap, label: string) => {
    const row = { ...next, label };
    setSnap(row);
    setVersions((was) => [...was, row]);
  };

  const askSend = (n: number, base: Snap) => {
    const kind = SENDS[n];
    if (!kind) {
      if (base.send.includes("rec")) {
        setPhase("walk");
        setI(0);
        say(W.walkOne(W.walkSteps.best));
      } else {
        setPhase("who");
        setI(0);
        say("Do you check each answer before it goes?");
      }
      keep(base, `Steps v${versions.length + 1}`);
      return;
    }
    setPhase("send");
    setI(n);
    say(W.sendOne(SEND[kind][0]));
  };

  const onBrief = (text: string) => {
    const spec = /first one|^1$|speaking coach/i.test(text) ? "Speaking coach" : text.trim();
    if (!spec || /^something else$/i.test(spec)) {
      say("Say it in your own words.");
      return;
    }
    mine(spec);
    const next = { ...snap, spec };
    keep(next, "Brief v1");
    askSend(0, next);
  };

  const onSend = async (text: string) => {
    const yes = /^(yes|the first one|1)$/i.test(text.trim());
    const no = /^no$/i.test(text.trim());
    if (phase !== "model" && phase !== "paste" && phase !== "look" && phase !== "done") {
      if (!yes && !no) {
        say("Yes or no.");
        return;
      }
      mine(yes ? "Yes" : "No");
    }
    if (phase === "send") {
      const kind = SENDS[i];
      let send = snap.send.filter((k) => k !== kind);
      if (yes) send = [...send, kind];
      if (i + 1 >= SENDS.length && !send.length) send = [kind];
      const next = { ...snap, send };
      setSnap(next);
      askSend(i + 1, next);
      return;
    }
    if (phase === "walk") {
      const id = WALKS[i];
      let walk = snap.walk.filter((k) => k !== id);
      if (yes) walk = [...walk, id];
      if (i + 1 >= WALKS.length && !walk.length) walk = [id];
      const next = { ...snap, walk };
      setSnap(next);
      if (i + 1 < WALKS.length) {
        setI(i + 1);
        say(W.walkOne(W.walkSteps[WALKS[i + 1]]));
        return;
      }
      keep(next, `Steps v${versions.length + 1}`);
      setPhase("who");
      setI(0);
      say("Do you check each answer before it goes?");
      return;
    }
    if (phase === "who") {
      if (i === 0 && !yes) {
        setI(1);
        say("Do you write every answer yourself?");
        return;
      }
      const who: Who = i === 0 ? "shadow" : yes ? "you" : "assistant";
      const next = { ...snap, who };
      keep(next, `Coach v${versions.length + 1}`);
      setPhase("pay");
      say("Do people pay to use it?");
      return;
    }
    if (phase === "pay") {
      if (!yes) {
        const next = { ...snap, pay: false, price: 0 };
        setSnap(next);
        setPhase("machine");
        say("Train it on your own answers?");
        return;
      }
      setSnap({ ...snap, pay: true });
      setPriceAt(0);
      setPhase("price");
      say(`Charge ${PRICES[0]}?`);
      return;
    }
    if (phase === "price") {
      if (yes) {
        const next = { ...snap, price: PRICES[priceAt] };
        setSnap(next);
        setPhase("machine");
        say("Train it on your own answers?");
        return;
      }
      const n = priceAt + 1;
      if (n >= PRICES.length) {
        setSnap({ ...snap, price: 0 });
        setPhase("machine");
        say("Train it on your own answers?");
        return;
      }
      setPriceAt(n);
      say(`Charge ${PRICES[n]}?`);
      return;
    }
    if (phase === "machine") {
      const next = { ...snap, machine: yes };
      setSnap(next);
      setPhase("connect");
      say("Use a model that already exists?");
      return;
    }
    if (phase === "connect") {
      if (!yes) {
        setSnap({ ...snap, connect: false, model: "" });
        setPhase("code");
        say("Will you add your own code later?");
        return;
      }
      setSnap({ ...snap, connect: true });
      setPhase("model");
      say(models.length ? "Which one?" : "What should it notice?", models.map((m) => m.q));
      return;
    }
    if (phase === "model") {
      const picked = models.length ? (/^the first one$/i.test(text.trim()) ? models[0] : models.find((m) => m.q === text.trim()) ?? models[0]) : null;
      const model = picked?.id ?? text.trim();
      const next = { ...snap, model };
      setSnap(next);
      mine(picked?.q ?? text.trim());
      setPhase("code");
      say("Will you add your own code later?");
      return;
    }
    if (phase === "code") {
      if (!yes) {
        const next = { ...snap, code: false, paste: "" };
        keep(next, `Look v${versions.length + 1}`);
        setPhase("look");
        say(next.spec === "Speaking coach" ? "Hi. Record a short talk, and I'll tell you what worked." : "Your chat is ready.", ["Open the list", "Try it out loud"]);
        return;
      }
      setSnap({ ...snap, code: true });
      setPhase("paste");
      say("Paste the step, then send it.");
      return;
    }
    if (phase === "paste") {
      const checked = await checkPlugin(text);
      if (checked.status !== "checked") {
        say(`That was refused (${checked.reasons[0] ?? "no"}). Paste another.`);
        return;
      }
      const next = { ...snap, code: true, paste: text };
      keep(next, `Look v${versions.length + 1}`);
      setPhase("look");
      say("Your chat is ready.", ["Open the list", "Try it out loud"]);
      return;
    }
    if (phase === "look") {
      if (/list|open/i.test(text)) return onList();
      setPhase("done");
      say("This is the chat.", ["Open the list", "Try it out loud"]);
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
        void transcribe(blob).then((text) => { if (text) take(text); });
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
    if (/^done$/i.test(text.trim()) && phase !== "brief") {
      mine("done");
      setPhase("done");
      say("This is the chat.", ["Open the list", "Try it out loud"]);
      return;
    }
    if (phase === "brief") onBrief(text);
    else onSend(text);
  };

  const undo = () => {
    setVersions((was) => {
      if (!was.length) return was;
      const prev = was.slice(0, -1);
      setSnap(prev.at(-1) ?? empty());
      setLines((linesNow) => linesNow.slice(0, -2));
      return prev;
    });
  };

  const move = (id: typeof WALKS[number], dir: -1 | 1) => {
    const at = snap.walk.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= snap.walk.length) return;
    const walk = [...snap.walk];
    const [row] = walk.splice(at, 1);
    walk.splice(to, 0, row);
    setSnap({ ...snap, walk });
  };

  return (
    <div data-talk-build="" data-talk-snap={JSON.stringify({ spec: snap.spec, send: snap.send, walk: snap.walk, who: snap.who, pay: snap.pay, price: snap.price, machine: snap.machine, connect: snap.connect, code: snap.code, model: snap.model, paste: snap.paste })} className="flex min-h-0 flex-1 flex-col bg-background">
      <div data-talk-steps="" className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-4 text-[12.5px]" aria-label="Progress">
        {STEPS.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5">
            {i > 0 ? <i className="block h-px w-2.5 bg-[#d4d4d4]" aria-hidden /> : null}
            <span data-talk-step={name} className={name === stepName ? "font-semibold text-foreground" : "font-medium text-[#a3a3a3]"}>{name}</span>
          </span>
        ))}
        <button type="button" data-talk-undo="" className="ml-auto inline-flex min-h-[30px] items-center rounded-full bg-muted px-[11px] text-[12.5px] font-medium disabled:opacity-40" onClick={undo} disabled={!versions.length}>Undo{versions.length ? `: ${versions.at(-1)?.label}` : ""}</button>
      </div>
      {versions.length ? <p data-talk-version="" className="mx-4 mt-3 flex min-h-8 items-center rounded-2xl border border-border px-3 text-[14px] font-semibold">{versions.at(-1)?.label}</p> : null}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {lines.map((line, n) => (
          <div key={n} className={line.who === "me" ? "max-w-[86%] self-end rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] text-primary-foreground" : "max-w-[86%] self-start rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]"}>
            <p className="m-0">{line.text}</p>
            {line.quotes?.map((q) => (
              <button key={q} type="button" data-quote="" data-say={q} className="mx-0.5 inline min-h-11 rounded-[7px] bg-[#fff1e8] px-[5px] text-left font-semibold text-[#c84d06]" onClick={() => setDraft(q)}>“{q}”</button>
            ))}
          </div>
        ))}
        {phase !== "brief" && phase !== "look" && phase !== "done" && phase !== "paste" && phase !== "model" ? (
          <div className="flex gap-2">
            <button type="button" className="h-[52px] flex-1 rounded-full border border-border text-[16px] font-medium" onClick={() => take("No")}>No</button>
            <button type="button" className="h-[52px] flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => take("Yes")}>Yes</button>
          </div>
        ) : null}
        {snap.walk.length > 1 ? (
          <ol data-talk-order="" className="m-0 flex list-none flex-col gap-2 p-0">
            {snap.walk.map((id) => (
              <li key={id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain") as typeof id; const walk = snap.walk.filter((k) => k !== from); const at = walk.indexOf(id); walk.splice(at, 0, from); setSnap({ ...snap, walk }); }} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border px-3">
                <span className="text-[15px]">{W.walkSteps[id]}</span>
                <button type="button" data-move="earlier" aria-label={`Earlier ${W.walkSteps[id]}`} className="ml-auto min-h-11 px-2" onClick={() => move(id, -1)}>Earlier</button>
                <button type="button" data-move="later" aria-label={`Later ${W.walkSteps[id]}`} className="min-h-11 px-2" onClick={() => move(id, 1)}>Later</button>
              </li>
            ))}
          </ol>
        ) : null}
        {phase === "done" ? (
          <div data-talk-result="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <p className="m-0 text-[16px] font-semibold">{snap.spec || "Your chat"}</p>
            <button type="button" className="min-h-11 rounded-full bg-foreground text-[15px] font-semibold text-background" onClick={onList}>Open the list</button>
            <button type="button" className="min-h-11 rounded-full border border-border text-[15px] font-semibold" onClick={() => say(snap.spec === "Speaking coach" ? "Hi. Record a short talk, and I'll tell you what worked." : "Say the first thing people should hear.")}>Try it out loud</button>
          </div>
        ) : null}
      </div>
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
