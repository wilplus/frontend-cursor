"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bffFetch } from "@/lib/api/bffFetch";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { fileName, useRecorder } from "./ShapeFix";
import { ClipCard, PastAnswers, savedLabels, type Clip } from "./TrainingPanel";
import { Bubble, choiceBubble } from "./ui";
import { casePath, patternInput, patternRequest, speakingPatternPath, type PatternExample, type PatternResponse } from "./speakingPatterns";

/* Act it (backend N708, N709, N711): the founder names a mistake in one
   state, records the error or imports an audio file, then the same line
   said the right way. A longer recording is cut into moments by the import
   lane; the founder keeps one with "This one". Both are measured with the
   VV suite and kept as one pair. */

type Suite = { version?: string; vocal?: Record<string, number | null>; verbal?: Record<string, number | null> };
type ActedClip = { snippet_id: string; words: string; duration_ms: number; start_offset_ms: number; src: string | null; vv?: Suite | null };
type ActedRecording = {
  session_id: string; state: string; pattern: string; status: string; role?: string;
  pair_of?: string | null; snippet_id?: string | null; clips: ActedClip[];
};
type Acted = { recordings: ActedRecording[]; names: string[] };
type Step = "name" | "error" | "waitError" | "pick" | "correct" | "waitCorrect" | "pickCorrect" | "pair";

const ACTED_PATH = `${speakingPatternPath}/acted`;
const STATE = "tense";
const STATE_LINE = "Tense (high arousal, negative)";
/** Long enough for several moments. The import lane cuts them (N711). */
const MAX_SECONDS = 180;
const POLL_MS = 3000;
const POLL_TRIES = 60;
/** One poll must end. A measure that never returned left this screen up. */
const POLL_TIMEOUT_MS = 15_000;
const WAIT_MS = POLL_TRIES * POLL_MS;

async function readActed(timeoutMs?: number): Promise<Acted> {
  return patternRequest<Acted>(ACTED_PATH, "GET", undefined, timeoutMs);
}

const needsPick = (recording: ActedRecording) => recording.clips.length > 1 && !recording.snippet_id;
const keptClip = (recording: ActedRecording) =>
  recording.clips.find((clip) => clip.snippet_id === recording.snippet_id) ?? recording.clips[0];

const clipsOf = (recording: ActedRecording, label: string): Clip[] => recording.clips.map((c, at) => ({
  source: "corpus", session_id: recording.session_id, snippet_id: c.snippet_id, acted: true,
  label: recording.clips.length > 1 ? `${label}, part ${at + 1}` : label,
  words: c.words, src: c.src, start: c.start_offset_ms, duration: c.duration_ms,
}));

/** The newest written-out error that has no right way recorded yet. */
function unpaired(acted: Acted): ActedRecording | null {
  const answered = new Set(acted.recordings.filter((r) => r.role === "correct").map((r) => r.pair_of));
  return acted.recordings.find((r) => (r.role ?? "error") === "error" && r.status === "ready"
    && r.clips.length && !answered.has(r.session_id)) ?? null;
}

/** The error's clips get its name as Pattern Library labels: the moment function's examples. */
async function labelError(error: ActedRecording): Promise<PatternExample[]> {
  const rows: PatternExample[] = [];
  for (const clip of clipsOf(error, "")) {
    const saved = await patternRequest<PatternResponse>(casePath(clip), "POST", {
      kind: "error", pattern: error.pattern, start_ms: 0, end_ms: clip.duration, note: `Act it · ${error.state || STATE}`,
    });
    const mine = saved.examples[saved.examples.length - 1];
    if (mine) rows.push(mine);
  }
  return rows;
}

export default function ActIt() {
  const locale = useUiLocale();
  const [acted, setActed] = useState<Acted | null>(null);
  const [labels, setLabels] = useState<PatternExample[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(locale === "pl" ? "pl" : "en");
  const [error, setError] = useState<ActedRecording | null>(null);
  const [correct, setCorrect] = useState<ActedRecording | null>(null);
  const [sent, setSent] = useState("");
  const [past, setPast] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([readActed(), savedLabels("corpus").catch(() => [] as PatternExample[])]).then(([got, saved]) => {
      if (!active) return;
      const mine = new Set(got.recordings.map((r) => r.session_id));
      setActed(got); setLabels(saved.filter((row) => mine.has(row.session_id)));
      const open = unpaired(got);
      if (open) { setError(open); setName(open.pattern); setStep(needsPick(open) ? "pick" : "correct"); }
    }).catch(() => { if (active) setNotice("Couldn’t open Act it. Try again."); });
    return () => { active = false; };
  }, []);

  const actedSessions = useMemo(() => new Set((acted?.recordings ?? []).map((r) => r.session_id)), [acted]);
  const restart = (line: string) => { setError(null); setCorrect(null); setStep("name"); setNotice(line); };
  const failed = () => restart("Couldn’t write out that recording. Record it again.");
  async function keepMoment(recording: ActedRecording, snippetId: string) {
    setNotice("");
    try {
      await patternRequest(`${ACTED_PATH}/choice`, "POST", { session_id: recording.session_id, snippet_id: snippetId });
    } catch (caught) {
      setNotice(caught instanceof Error && caught.message ? caught.message : "Couldn’t open or save the pattern library. Try again.");
      return;
    }
    const clip = recording.clips.find((item) => item.snippet_id === snippetId);
    const picked = { ...recording, snippet_id: snippetId };
    if ((recording.role ?? "error") !== "correct") {
      setError(picked);
      if (clip) void labelError({ ...picked, clips: [clip] }).then((rows) => setLabels((was) => [...rows, ...was])).catch(() => undefined);
      setStep("correct");
      return;
    }
    setCorrect(picked);
    setStep("pair");
  }

  if (past) {
    return <PastAnswers source="corpus" empty="No acted mistakes yet." onBack={() => setPast(false)}
      labels={labels.filter((row) => actedSessions.has(row.session_id))}
      onUndone={(id) => setLabels((was) => was.filter((row) => row.id !== id))} />;
  }
  return <div data-act-it="" className="flex flex-col gap-4">
    {step === "name" ? <NameStep names={acted?.names ?? []} name={name} language={language}
      onName={setName} onLanguage={setLanguage} onContinue={() => { setNotice(""); setStep("error"); }} /> : null}
    {step === "error" ? <RecordStep key="error" title="Record the mistake" again="Record again" name={name}
      fields={{ pattern: name.trim(), language }} onBack={() => setStep("name")}
      onSent={(id) => { setSent(id); setStep("waitError"); }} onNotice={setNotice} /> : null}
    {step === "waitError" ? <Waiting sessionId={sent} onFailed={failed} onReady={(found, names) => {
      setActed((was) => was ? { ...was, names } : was);
      const clip = found.clips[0];
      const picked = needsPick(found) ? found : { ...found, snippet_id: clip?.snippet_id };
      setError(picked);
      if (needsPick(found)) { setStep("pick"); return; }
      if (clip) void labelError({ ...picked, clips: [clip] }).then((rows) => setLabels((was) => [...rows, ...was])).catch(() => undefined);
      setStep("correct");
    }} /> : null}
    {step === "pick" && error ? <PickMoment recording={error} label="Your mistake"
      onPick={(id) => void keepMoment(error, id)} /> : null}
    {step === "correct" && error ? <>
      <ClipCard clip={oneOf(error, "Your mistake")} chosen={false} onWindow={() => undefined} />
      <RecordStep key="correct" title="Record it the right way" again="Say it again" name={error.pattern}
        fields={{ role: "correct", pair_of: error.session_id, language }} onBack={() => restart("")}
        onSent={(id) => { setSent(id); setStep("waitCorrect"); }} onNotice={setNotice} />
    </> : null}
    {step === "waitCorrect" ? <Waiting sessionId={sent} onFailed={failed}
      onReady={(found) => {
        const picked = needsPick(found) ? found : { ...found, snippet_id: found.clips[0]?.snippet_id };
        setCorrect(picked);
        setStep(needsPick(found) ? "pickCorrect" : "pair");
      }} /> : null}
    {step === "pickCorrect" && correct ? <PickMoment recording={correct} label="The right way"
      onPick={(id) => void keepMoment(correct, id)} /> : null}
    {step === "pair" && error && correct ? <Pair error={error} correct={correct} onNext={() => restart("Saved.")} /> : null}
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
    <p data-act-state={STATE} className="m-0 text-[15px] text-muted-foreground">{STATE_LINE}</p>
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

/** One recording: record, listen, record again or keep; Keep sends it. */
function RecordStep({ title, again, name, fields, onBack, onSent, onNotice }: {
  title: string; again: string; name: string; fields: Record<string, string>;
  onBack: () => void; onSent: (sessionId: string) => void; onNotice: (line: string) => void;
}) {
  const [audio, setAudio] = useState<Blob | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mic = useRecorder(MAX_SECONDS, (blob) => { setAudio(blob); setHeard(URL.createObjectURL(blob)); });
  const file = useRef<HTMLInputElement>(null);
  const takeFile = (list: FileList | null) => {
    const picked = list?.[0];
    if (!picked) return;
    setAudio(picked);
    setHeard(URL.createObjectURL(picked));
  };
  useEffect(() => () => { if (heard) URL.revokeObjectURL(heard); }, [heard]);
  const keep = async () => {
    if (!audio) return;
    setSending(true); onNotice("");
    const form = new FormData();
    form.append("audio_file", audio, fileName(audio));
    form.append("state", STATE);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const result = await bffFetch(ACTED_PATH, { method: "POST", body: form, timeoutMs: 55_000 });
    setSending(false);
    const id = result.kind === "response" && result.ok ? (result.body as { session_id?: string } | null)?.session_id : null;
    if (id) { onSent(id); return; }
    const body = result.kind === "response" ? result.body as { error?: string } | null : null;
    onNotice(body?.error || "Couldn’t send the recording. Try again.");
  };
  return <>
    <p className="m-0 text-[15px] text-muted-foreground">{`${STATE_LINE} · ${name.trim()}`}</p>
    <h2 className="m-0 text-[20px] font-semibold">{title}</h2>
    <div className="flex flex-wrap gap-2">
      {mic.recording
        ? <button type="button" data-act-stop="" className={choiceBubble(true)} onClick={mic.stop}>Stop</button>
        : <button type="button" data-act-record="" className={choiceBubble(!audio)} disabled={sending}
            onClick={() => void mic.start()}>{audio ? again : title}</button>}
      {mic.recording ? null : <button type="button" className={choiceBubble(false)} disabled={sending}
        onClick={() => file.current?.click()}>Import audio</button>}
      <input ref={file} type="file" accept="audio/*" hidden onChange={(event) => takeFile(event.target.files)} />
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

/** Waits while the import lane writes this recording out and measures it. */
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
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const look = async () => {
      tries += 1;
      const got = await readActed(POLL_TIMEOUT_MS).catch(() => null);
      if (stopped) return;
      const mine = got?.recordings.find((r) => r.session_id === sessionId);
      const gaveUp = tries >= POLL_TRIES || Date.now() - started >= WAIT_MS;
      if (got && mine?.status === "ready" && mine.clips.length) { ready.current(mine, got.names); return; }
      if (mine?.status === "failed" || (mine?.status === "ready" && !mine.clips.length) || gaveUp) {
        failed.current(); return;
      }
      timer = setTimeout(() => void look(), POLL_MS);
    };
    void look();
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId]);
  return <Bubble role="status">Writing out your words…</Bubble>;
}

const cueName = (key: string) => key.replace(/_/g, " ");
const shown = (value: number | null | undefined) => (value === null || value === undefined ? "–" : String(value));

/** The pair: both recordings, and their VV suites side by side. */
function oneOf(recording: ActedRecording, label: string): Clip {
  const clip = keptClip(recording);
  return clipsOf({ ...recording, clips: clip ? [clip] : [] }, label)[0];
}

function PickMoment({ recording, label, onPick }: {
  recording: ActedRecording; label: string; onPick: (snippetId: string) => void;
}) {
  return <>
    {clipsOf(recording, label).map((clip) => <ClipCard key={clip.snippet_id} clip={clip} chosen={false}
      onPick={() => onPick(clip.snippet_id)} onWindow={() => undefined} />)}
  </>;
}

function Pair({ error, correct, onNext }: { error: ActedRecording; correct: ActedRecording; onNext: () => void }) {
  const a = keptClip(error)?.vv ?? null;
  const b = keptClip(correct)?.vv ?? null;
  return <div data-act-pair="" className="flex flex-col gap-3">
    <p className="m-0 text-[15px] text-muted-foreground">{`${STATE_LINE} · ${error.pattern}`}</p>
    <ClipCard clip={oneOf(error, "Your mistake")} chosen={false} onWindow={() => undefined} />
    <ClipCard clip={oneOf(correct, "The right way")} chosen onWindow={() => undefined} />
    {a && b ? (["vocal", "verbal"] as const).map((half) => <table key={half} data-vv={half} className="w-full text-[14px]">
      <thead><tr className="text-left text-muted-foreground">
        <th className="py-1 font-semibold">{half === "vocal" ? "Vocal" : "Verbal"}</th><th>Your mistake</th><th>The right way</th>
      </tr></thead>
      <tbody>{Object.keys({ ...a[half], ...b[half] }).map((key) => <tr key={key} className="border-t border-border">
        <td className="py-1">{cueName(key)}</td><td>{shown(a[half]?.[key])}</td><td>{shown(b[half]?.[key])}</td>
      </tr>)}</tbody>
    </table>) : <Bubble>The cues of these recordings could not be measured yet.</Bubble>}
    <button type="button" data-act-next="" className={`${choiceBubble(true)} self-start`} onClick={onNext}>Continue</button>
  </div>;
}
