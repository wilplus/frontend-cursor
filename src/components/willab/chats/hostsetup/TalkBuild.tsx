"use client";

import { useEffect, useRef, useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import { BarBox, ChatBarRow } from "@/components/willab/chats/ChatBar";
import { W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { clearTalkDraft, markTalkReady, publishTalkDraft, saveTalkDraft, talkBuilt } from "@/lib/willab/chatBuilder/talkDraft";
import { VoiceModelList } from "@/components/willab/chats/voice/VoiceModelList";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { calmFromFile, LISTEN_QUESTION } from "@/lib/willab/experiments/voiceCatalog";
import { chooseModel, writeHold } from "@/lib/willab/experiments/voiceHold";
import { saveExperimentConfig } from "@/services/api/voiceCatalog";
import { giveAsk, jobAsk, questionFor, startersFor, voiceJob } from "./jobQuestions";
import { COACH_HELLO, editEffect, speakTurn, WRITTEN_PASTE, type Line, type Phase, type Snap } from "./talkTurn";

/* The chat, built by talking. One question at a time, in the same bubbles as
   every other chat. Taps sit above the box. A tap on an earlier answer opens
   that question again. The list of answers is Settings, not this screen. */

const JOBS = ["Speaking coach", "ML specialist", "Neurobiologist", "Someone else"];
const KIND_ORDER = ["rec", "photo", "file"] as const;
const KIND_LABEL: Record<(typeof KIND_ORDER)[number], string> = {
  rec: "A recording",
  photo: "A photo",
  file: "A file (a PDF or document)",
};
const PILL = "min-h-[44px] max-w-full rounded-[22px] border-[1.5px] border-primary px-4 py-[9px] text-left text-[15px] font-semibold leading-snug";
const OPENING: Line[] = [{ who: "will", text: "What do you do?" }];
const YESNO = new Set<Phase>(["send", "listen", "walk", "who", "pay", "price", "machine", "connect", "code", "other", "plan"]);

const blank = (): Snap => ({
  label: "", spec: "", send: [], walk: [], who: "shadow", pay: false, machine: false, code: false, connect: false, price: 0, model: "", otherModels: [], paste: "", plugin: null, hello: "",
});

function copySnap(snap: Snap): Snap {
  return { ...snap, send: [...snap.send], walk: [...snap.walk], otherModels: [...snap.otherModels] };
}

function hintFor(phase: Phase): string {
  if (phase === "brief") return "Say what you do";
  if (phase === "for" || phase === "give") return "Or type your own";
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

function kindNames(chosen: readonly SendKind[]): string {
  const names = KIND_ORDER.filter((id) => chosen.includes(id)).map((id) => KIND_LABEL[id]);
  return names.length ? names.join(" and ") : "Just a typed message";
}

function replyLabels(phase: string, spec: string, models: { q: string }[], draft: string): string[] {
  if (phase === "kinds") return [];
  if (phase === "for") return jobAsk(spec).taps;
  if (phase === "give") return giveAsk().taps;
  if (phase === "starters") return ["Yes", "Change them"];
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

export default function TalkBuild({ onList, onTry, onReady, models = [] }: {
  onList: () => void;
  /** Opens the chat as a visitor, the same as the Test tile. */
  onTry?: () => void;
  /** Build is finished. The home opens Settings. */
  onReady?: () => void;
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
  const [picked, setPicked] = useState<SendKind[]>([]);
  const pickedRef = useRef<SendKind[]>([]);
  const fixAt = useRef<number | null>(null);
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
  const labels = replyLabels(asking, snap.spec, models, draft);

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
    if (next.phase === "kinds") {
      pickedRef.current = [];
      setPicked([]);
    }
    if (snapRef.current.spec) saveTalkDraft(talkBuilt(copySnap(snapRef.current)));
  };

  const finish = (next: Snap, add: Line[], label: string) => {
    write({ snap: next, phase: "look", i: 0, add, label });
    const built = talkBuilt(snapRef.current);
    saveTalkDraft(built);
    markTalkReady(true);
    setSavedName(built.definition.name);
    onReady?.();
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
      add: [{ who: "me", text: spec, q: "brief" }, { who: "will", text: W.sendMore }],
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

  const setKinds = (next: SendKind[]) => {
    pickedRef.current = next;
    setPicked(next);
  };

  const goOn = () => {
    const voice = snapRef.current.send.includes("rec") && voiceJob(snapRef.current.spec);
    const ask = voice
      ? { phase: "walk" as Phase, text: W.walkOne("best") }
      : { phase: "for" as Phase, text: jobAsk(snapRef.current.spec).question };
    write({ phase: ask.phase, i: 0, add: [{ who: "will", text: ask.text }] });
    if (!voice) {
      const spec = snapRef.current.spec;
      void questionFor(spec).then((got) => {
        if (phaseRef.current !== "for" || got.question === jobAsk(spec).question) return;
        const next = linesRef.current.map((line, n) => n === linesRef.current.length - 1 && line.who === "will" ? { ...line, text: got.question } : line);
        linesRef.current = next;
        setLines(next);
      });
    }
  };

  const commitKinds = (chosen: SendKind[]) => {
    const send: SendKind[] = (["rec", "text", "photo", "file"] as SendKind[]).filter((id) => id === "text" || chosen.includes(id));
    const text = kindNames(chosen);
    const editAt = editingRef.current;
    const hadRec = snapRef.current.send.includes("rec");
    const hasRec = send.includes("rec");
    if (editAt !== null && hadRec === hasRec) {
      const nextLines = linesRef.current.map((row, n) => (n === editAt ? { ...row, text } : row));
      const next = { ...snapRef.current, send };
      linesRef.current = nextLines;
      snapRef.current = next;
      setLines(nextLines);
      setSnap(next);
      editingRef.current = null;
      setEditing(null);
      setKinds([]);
      if (next.spec) saveTalkDraft(talkBuilt(copySnap(next)));
      return;
    }
    if (editAt !== null) {
      const line = linesRef.current[editAt];
      linesRef.current = linesRef.current.slice(0, editAt);
      if (line?.before) snapRef.current = copySnap(line.before);
      editingRef.current = null;
      setEditing(null);
    }
    const voice = hasRec && voiceJob(snapRef.current.spec);
    if (hasRec) {
      write({ snap: { ...snapRef.current, send }, phase: "listen", i: 0, add: [{ who: "me", text, q: "kinds" }, { who: "will", text: LISTEN_QUESTION }] });
      setKinds([]);
      return;
    }
    const ask = voice
      ? { phase: "walk" as Phase, text: W.walkOne("best") }
      : { phase: "for" as Phase, text: jobAsk(snapRef.current.spec).question };
    write({ snap: { ...snapRef.current, send }, phase: ask.phase, i: 0, add: [{ who: "me", text, q: "kinds" }, { who: "will", text: ask.text }] });
    if (!voice) {
      const spec = snapRef.current.spec;
      void questionFor(spec).then((got) => {
        if (phaseRef.current !== "for" || got.question === jobAsk(spec).question) return;
        const next = linesRef.current.map((line, n) => n === linesRef.current.length - 1 && line.who === "will" ? { ...line, text: got.question } : line);
        linesRef.current = next;
        setLines(next);
      });
    }
    setKinds([]);
  };

  const take = (text: string) => {
    const editingKinds = editingRef.current !== null && linesRef.current[editingRef.current]?.q === "kinds";
    if (phaseRef.current === "kinds" || editingKinds) {
      const said = text.trim().toLowerCase();
      if (said === "done") commitKinds(pickedRef.current);
      else {
        const id = KIND_ORDER.find((kind) => KIND_LABEL[kind].toLowerCase() === said);
        if (id) setKinds(pickedRef.current.includes(id) ? pickedRef.current.filter((kind) => kind !== id) : [...pickedRef.current, id]);
      }
      return;
    }
    if (phaseRef.current === "listen") {
      const said = text.trim().toLowerCase();
      if (said !== "yes" && said !== "no") return;
      write({ add: [{ who: "me", text: said === "yes" ? "Yes" : "No", q: "listen" }] });
      if (said === "yes") {
        phaseRef.current = "listenPick";
        setPhase("listenPick");
        return;
      }
      goOn();
      return;
    }
    if (phaseRef.current === "listenPick") return;
    if (phaseRef.current === "for" || phaseRef.current === "give") {
      const said = text.trim();
      if (!said) return;
      const next = phaseRef.current === "for"
        ? { snap: { ...snapRef.current, asked: said }, phase: "give" as Phase, ask: giveAsk().question, q: "for" }
        : { snap: { ...snapRef.current, gives: said }, phase: "who" as Phase, ask: W.talkCheck, q: "give" };
      write({ snap: next.snap, phase: next.phase, i: 0, add: [{ who: "me", text: said, q: next.q }, { who: "will", text: next.ask }] });
      return;
    }
    if (fixAt.current !== null) {
      const list = [...(snapRef.current.starters ?? startersFor(snapRef.current.spec))];
      const said = text.trim();
      if (said) list[fixAt.current] = said;
      const at = fixAt.current + 1;
      if (at < list.length) {
        fixAt.current = at;
        snapRef.current = { ...snapRef.current, starters: list };
        setSnap(snapRef.current);
        setDraft(list[at]);
        return;
      }
      fixAt.current = null;
      write({
        snap: { ...snapRef.current, starters: list }, phase: "plan", i: 0,
        add: [{ who: "me", text: list.join(" · "), q: "starters" }, { who: "will", text: "Say go?" }],
      });
      return;
    }
    if (phaseRef.current === "starters" && /^yes$/i.test(text.trim())) {
      const starters = snapRef.current.starters ?? startersFor(snapRef.current.spec);
      write({
        snap: { ...snapRef.current, starters }, phase: "plan", i: 0,
        add: [
          { who: "me", text: "Yes", q: "starters" },
          { who: "will", text: "Say go?" },
        ],
      });
      return;
    }
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
      onTry?.();
      return;
    }
    if (q === "for") {
      if (label === "Something else") {
        document.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")?.focus();
        return;
      }
      write({
        snap: { ...snapRef.current, asked: label }, phase: "give", i: 0,
        add: [{ who: "me", text: label, q: "for" }, { who: "will", text: giveAsk().question }],
      });
      return;
    }
    if (q === "give") {
      write({
        snap: { ...snapRef.current, gives: label }, phase: "who", i: 0,
        add: [{ who: "me", text: label, q: "give" }, { who: "will", text: W.talkCheck }],
      });
      return;
    }
    if (q === "starters") {
      if (label === "Change them") {
        const list = snapRef.current.starters ?? startersFor(snapRef.current.spec);
        fixAt.current = 0;
        setDraft(list[0] ?? "");
        return;
      }
      const starters = snapRef.current.starters ?? startersFor(snapRef.current.spec);
      write({
        snap: { ...snapRef.current, starters }, phase: "plan", i: 0,
        add: [
          { who: "me", text: "Yes", q: "starters" },
          { who: "will", text: `${snapRef.current.spec || "Your chat"}. First line: ${snapRef.current.hello || "Your chat is ready."}` },
          { who: "will", text: "Say go?" },
        ],
      });
      return;
    }
    submit(label);
  };

  const helloLine = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  const openEdit = (index: number) => {
    editingRef.current = index;
    setEditing(index);
    const line = linesRef.current[index];
    if (line?.q === "kinds") setKinds(KIND_ORDER.filter((id) => snapRef.current.send.includes(id)));
  };

  return (
    <div data-talk-build="" data-talk-phase={phase} data-talk-saved={savedName || undefined} data-talk-snap={JSON.stringify({ spec: snap.spec, send: snap.send, walk: snap.walk, who: snap.who, pay: snap.pay, price: snap.price, machine: snap.machine, connect: snap.connect, code: snap.code, model: snap.model, otherModels: snap.otherModels, paste: snap.paste, hello: snap.hello, asked: snap.asked, gives: snap.gives })} className="flex min-h-0 flex-1 flex-col bg-background">
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
        {phase === "look" || phase === "done" ? (
          <div data-row="app" className="mr-auto flex max-w-[88%]">
            <div data-bubble="" data-talk-greeting="" className={WILL}>{helloLine}</div>
          </div>
        ) : null}
        {kept ? <div data-row="app" className="mr-auto flex max-w-[88%]"><div data-talk-kept="" className={WILL}>Kept.</div></div> : null}
        {liveDraft ? <div data-row="app" className="mr-auto flex max-w-[88%]"><div data-talk-live="" className={WILL}>Live on this device.</div></div> : null}
      </div>
      {phase === "listenPick" ? (
        <VoiceModelList
          onSkip={goOn}
          onPick={(model) => {
            const prompts = model.needs_baseline ? calmFromFile() : [];
            chooseModel(model);
            writeHold({ prompts });
            void saveExperimentConfig(readOwnChat().id || "your-chat", {
              model_id: model.id,
              baseline_prompt_ids: prompts.map((row) => row.id),
            });
            goOn();
          }}
        />
      ) : null}
      {asking === "kinds" ? (
        <div data-talk-replies="" data-tap-row="" className="ml-auto flex w-full max-w-[86%] flex-col items-end gap-2 px-3 pb-1">
          {KIND_ORDER.map((id) => {
            const on = picked.includes(id);
            return (
              <button key={id} type="button" data-kind={id} aria-pressed={on} className={`${PILL} ${on ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`} onClick={() => setKinds(on ? picked.filter((kind) => kind !== id) : [...picked, id])}>
                {on ? `✓ ${KIND_LABEL[id]}` : KIND_LABEL[id]}
              </button>
            );
          })}
          <button type="button" data-kinds-done="" className={`${PILL} bg-primary text-primary-foreground`} onClick={() => commitKinds(pickedRef.current)}>{W.sendDone}</button>
        </div>
      ) : labels.length ? (
        <div className="px-3 pb-1">
          <TapRow labels={labels} even={labels.length !== 2} onTap={onReply} dataAttr={{ "data-talk-replies": "", "data-tap-row": "" }} />
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
