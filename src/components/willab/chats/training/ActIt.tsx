"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bffFetch } from "@/lib/api/bffFetch";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { fileName, useRecorder } from "./ShapeFix";
import { ClipCard, PastAnswers, SHAPED, ShapeStep, WhatItGets, savedLabels, type Clip } from "./TrainingPanel";
import { Bubble, choiceBubble } from "./ui";
import { casePath, errorTools, patternInput, patternRequest, speakingPatternPath, type PatternExample, type PatternResponse } from "./speakingPatterns";

/* Act it (backend N708): the founder acts a mistake in one state, names it,
   records it, then says what fixes it and shapes each fix. The recording is
   written out by the corpus import lane; its labels are Pattern Library rows
   on its clips, so Sniper, Rephrase and AI Audio shape them as any clip. */

type ActedClip = { snippet_id: string; words: string; duration_ms: number; start_offset_ms: number; src: string | null };
type ActedRecording = { session_id: string; state: string; pattern: string; status: string; clips: ActedClip[] };
type Acted = { recordings: ActedRecording[]; names: string[] };
type Step = "name" | "record" | "waiting" | "fix";

const ACTED_PATH = `${speakingPatternPath}/acted`;
const STATE = "tense";
/** One sentence: about twelve seconds stays one clip. */
const MAX_SECONDS = 12;
const POLL_MS = 3000;
const POLL_TRIES = 60;
const FIXES = (["ai_audio", "rewrite", "sniper", "coach_video"] as const).map((id) => [id, errorTools[id]] as [string, string]);

async function readActed(): Promise<Acted> {
  return patternRequest<Acted>(ACTED_PATH);
}

const clipsOf = (recording: ActedRecording): Clip[] => recording.clips.map((c, at) => ({
  source: "corpus", session_id: recording.session_id, snippet_id: c.snippet_id, acted: true,
  label: recording.clips.length > 1 ? `Your mistake, part ${at + 1}` : "Your mistake",
  words: c.words, src: c.src, start: c.start_offset_ms, duration: c.duration_ms,
}));

/** The newest written-out recording none of whose clips has a label yet. */
function unlabelled(acted: Acted, labels: PatternExample[]): ActedRecording | null {
  const done = new Set(labels.map((row) => row.session_id));
  return acted.recordings.find((r) => r.status === "ready" && r.clips.length && !done.has(r.session_id)) ?? null;
}

export default function ActIt() {
  const locale = useUiLocale();
  const [acted, setActed] = useState<Acted | null>(null);
  const [labels, setLabels] = useState<PatternExample[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(locale === "pl" ? "pl" : "en");
  const [recording, setRecording] = useState<ActedRecording | null>(null);
  const [sent, setSent] = useState("");
  const [past, setPast] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([readActed(), savedLabels("corpus").catch(() => [] as PatternExample[])]).then(([got, saved]) => {
      if (!active) return;
      const mine = new Set(got.recordings.map((r) => r.session_id));
      const own = saved.filter((row) => mine.has(row.session_id));
      setActed(got); setLabels(own);
      const open = unlabelled(got, own);
      if (open) { setRecording(open); setName(open.pattern); setStep("fix"); }
    }).catch(() => { if (active) setNotice("Couldn’t open Act it. Try again."); });
    return () => { active = false; };
  }, []);

  const actedSessions = useMemo(() => new Set((acted?.recordings ?? []).map((r) => r.session_id)), [acted]);
  const restart = (line: string) => { setRecording(null); setStep("name"); setNotice(line); };

  if (past) {
    return <PastAnswers source="corpus" empty="No acted mistakes yet." onBack={() => setPast(false)}
      labels={labels.filter((row) => actedSessions.has(row.session_id))}
      onUndone={(id) => setLabels((was) => was.filter((row) => row.id !== id))} />;
  }
  return <div data-act-it="" className="flex flex-col gap-4">
    {step === "name" ? <NameStep names={acted?.names ?? []} name={name} language={language}
      onName={setName} onLanguage={setLanguage} onContinue={() => { setNotice(""); setStep("record"); }} /> : null}
    {step === "record" ? <RecordStep name={name} language={language} onBack={() => setStep("name")}
      onSent={(id) => { setSent(id); setStep("waiting"); }} onNotice={setNotice} /> : null}
    {step === "waiting" ? <Waiting sessionId={sent} onReady={(found, names) => {
      setActed((was) => was ? { ...was, names } : was);
      setRecording(found); setStep("fix");
    }} onFailed={() => restart("Couldn’t write out that recording. Record it again.")} /> : null}
    {step === "fix" && recording ? <FixSteps recording={recording}
      onSaved={(rows) => { setLabels((was) => [...rows, ...was]); restart("Saved."); }}
      onBack={() => restart("")} /> : null}
    {notice ? <Bubble role={notice === "Saved." ? "status" : "alert"}>{notice}</Bubble> : null}
    <button type="button" className="self-start text-[15px] underline" onClick={() => setPast(true)}>Your past answers</button>
  </div>;
}

function NameStep({ names, name, language, onName, onLanguage, onContinue }: {
  names: string[]; name: string; language: string;
  onName: (name: string) => void; onLanguage: (language: string) => void; onContinue: () => void;
}) {
  const [own, setOwn] = useState(names.includes(name) ? "" : name);
  return <>
    <p data-act-state={STATE} className="m-0 text-[15px] text-muted-foreground">Tense (high arousal, negative)</p>
    <h2 className="m-0 text-[20px] font-semibold">What kind of mistake?</h2>
    {names.length ? <div className="flex flex-wrap gap-2">
      {names.map((n) => <button key={n} type="button" data-act-name={n} aria-pressed={name === n} className={choiceBubble(name === n)}
        onClick={() => { setOwn(""); onName(n); }}>{n}</button>)}
    </div> : null}
    <input aria-label="Your own name" placeholder="Your own name" maxLength={100} value={own} className={patternInput}
      onChange={(event) => { setOwn(event.target.value); onName(event.target.value); }} />
    <div className="flex gap-2">
      {(["pl", "en"] as const).map((id) => <button key={id} type="button" aria-pressed={language === id}
        className={choiceBubble(language === id)} onClick={() => onLanguage(id)}>{id.toUpperCase()}</button>)}
    </div>
    <button type="button" data-act-continue="" className={`${choiceBubble(true)} self-start`} disabled={!name.trim()}
      onClick={onContinue}>Continue</button>
  </>;
}

function RecordStep({ name, language, onBack, onSent, onNotice }: {
  name: string; language: string; onBack: () => void; onSent: (sessionId: string) => void; onNotice: (line: string) => void;
}) {
  const [audio, setAudio] = useState<Blob | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mic = useRecorder(MAX_SECONDS, (blob) => { setAudio(blob); setHeard(URL.createObjectURL(blob)); });
  useEffect(() => () => { if (heard) URL.revokeObjectURL(heard); }, [heard]);
  const keep = async () => {
    if (!audio) return;
    setSending(true); onNotice("");
    const form = new FormData();
    form.append("audio_file", audio, fileName(audio));
    form.append("state", STATE); form.append("pattern", name.trim()); form.append("language", language);
    const result = await bffFetch(ACTED_PATH, { method: "POST", body: form, timeoutMs: 55_000 });
    setSending(false);
    const id = result.kind === "response" && result.ok ? (result.body as { session_id?: string } | null)?.session_id : null;
    if (id) { onSent(id); return; }
    const body = result.kind === "response" ? result.body as { error?: string } | null : null;
    onNotice(body?.error || "Couldn’t send the recording. Try again.");
  };
  return <>
    <p className="m-0 text-[15px] text-muted-foreground">{`Tense (high arousal, negative) · ${name.trim()}`}</p>
    <h2 className="m-0 text-[20px] font-semibold">Record the mistake</h2>
    <div className="flex flex-wrap gap-2">
      {mic.recording
        ? <button type="button" data-act-stop="" className={choiceBubble(true)} onClick={mic.stop}>Stop</button>
        : <button type="button" data-act-record="" className={choiceBubble(!audio)} disabled={sending}
            onClick={() => void mic.start()}>{audio ? "Record again" : "Record the mistake"}</button>}
    </div>
    {mic.denied ? <Bubble role="alert">Allow microphone access, then try again.</Bubble> : null}
    {heard ? <audio data-act-heard="" controls src={heard} className="w-full" /> : null}
    <div className="flex flex-wrap gap-2">
      <button type="button" data-act-keep="" className={choiceBubble(true)} disabled={!audio || sending || mic.recording}
        onClick={() => void keep()}>Keep</button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </>;
}

/** Waits while the import lane writes this recording out. */
function Waiting({ sessionId, onReady, onFailed }: {
  sessionId: string; onReady: (recording: ActedRecording, names: string[]) => void; onFailed: () => void;
}) {
  const ready = useRef(onReady);
  const failed = useRef(onFailed);
  ready.current = onReady;
  failed.current = onFailed;
  useEffect(() => {
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const look = async () => {
      tries += 1;
      const got = await readActed().catch(() => null);
      if (stopped) return;
      const mine = got?.recordings.find((r) => r.session_id === sessionId);
      if (got && mine?.status === "ready" && mine.clips.length) { ready.current(mine, got.names); return; }
      if (mine?.status === "failed" || (mine?.status === "ready" && !mine.clips.length) || tries >= POLL_TRIES) {
        failed.current(); return;
      }
      timer = setTimeout(() => void look(), POLL_MS);
    };
    void look();
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId]);
  return <Bubble role="status">Writing out your words…</Bubble>;
}

async function saveFix(clips: Clip[], name: string, tool: string, shape: Record<string, unknown> = {}) {
  const rows: PatternExample[] = [];
  for (const clip of clips) {
    const saved = await patternRequest<PatternResponse>(casePath(clip), "POST", {
      kind: "error", pattern: name, start_ms: 0, end_ms: clip.duration, note: "Act it · tense",
    });
    const mine = saved.examples[saved.examples.length - 1];
    if (!mine) continue;
    await patternRequest(casePath(clip), "PUT", { example_id: mine.id, intervention: {
      tool, name: errorTools[tool as keyof typeof errorTools], delivery: "", status: "approved", ...shape,
    } });
    rows.push(mine);
  }
  return rows;
}

/** What fixes it, then each fix shaped (N705, N706); every clip of the recording gets them. */
function FixSteps({ recording, onSaved, onBack }: {
  recording: ActedRecording; onSaved: (rows: PatternExample[]) => void; onBack: () => void;
}) {
  const clips = useMemo(() => clipsOf(recording), [recording]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [shaping, setShaping] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<PatternExample[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const first = clips[0];
  const run = async (work: () => Promise<PatternExample[]>, rest: string[]) => {
    setSaving(true); setNotice("");
    try {
      const rows = [...saved, ...await work()];
      setSaved(rows);
      if (rest.length) setShaping(rest); else onSaved(rows);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : "Couldn’t save. Try again.");
    } finally { setSaving(false); }
  };
  if (!first) return null;
  if (shaping?.[0]) {
    const tool = shaping[0];
    return <>
      <ShapeStep tool={tool} clip={first} onBack={() => setShaping(null)}
        onKeep={(kept, shape) => void run(() => saveFix(clips, recording.pattern, kept, shape), shaping.slice(1))} />
      {notice ? <Bubble role="alert">{notice}</Bubble> : null}
    </>;
  }
  return <>
    <p className="m-0 text-[15px] text-muted-foreground">{`Tense (high arousal, negative) · ${recording.pattern}`}</p>
    <WhatItGets clip={first} chosen={chosen} saving={saving} onWindow={() => undefined} tools={FIXES} title="What fixes it?"
      onToggle={(id) => setChosen((was) => (was.includes(id) ? was.filter((t) => t !== id) : [...was, id]))}
      onContinue={() => {
        const plain = chosen.filter((tool) => !SHAPED.includes(tool));
        const shaped = chosen.filter((tool) => SHAPED.includes(tool));
        void run(async () => (await Promise.all(plain.map((tool) => saveFix(clips, recording.pattern, tool)))).flat(), shaped);
      }} onBack={onBack} />
    {clips.slice(1).map((clip) => <ClipCard key={clip.snippet_id} clip={clip} chosen onWindow={() => undefined} />)}
    {notice ? <Bubble role="alert">{notice}</Bubble> : null}
  </>;
}
