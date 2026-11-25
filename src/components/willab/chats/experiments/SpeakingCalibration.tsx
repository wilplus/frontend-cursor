"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { bffFetch } from "@/lib/api/bffFetch";
import { withSessionBearer } from "@/lib/api/sessionBearer";
import { watchPaceStream, type PaceMic } from "@/lib/willab/pace/paceMic";
import PaceScale from "../../pace/PaceScale";
import { fetchTrainings } from "@/services/api/trainings";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import type { ReadoutSnippet } from "../../readout";
import { useVoiceNote } from "../../useVoiceNote";
import WalkPlayer from "../../walk/WalkPlayer";
import { Bubble, ChoicePair, Frame, choiceBubble } from "./bits";

const title = "Speaking Model Calibration";
const input = "min-w-0 rounded-lg border border-border bg-background px-3 py-2";
const labels = { ok: "Pace OK", rushed: "Rushed", slow: "Too slow", flat: "Flat emphasis", other: "Other", unsure: "Unsure" };
const exercises = { none: "No intervention", sniper: "Sniper", ai_audio: "AI Audio", rewrite: "Rephrase", coach_video: "Coach video" };
const cueNames: Record<string, string> = {
  wpm: "Words per minute", f0_mean: "Average pitch in Hz", f0_sd: "Pitch variation in Hz",
  pause_ratio: "Pause share", opening_contrast_db: "Opening loudness contrast in dB",
};
const targets = {
  pitch: { name: "Pitch change in semitones", min: -6, max: 6, step: 0.1 },
  pause_ms: { name: "Pause in milliseconds", min: 0, max: 2500, step: 1 },
  wpm: { name: "Words per minute", min: 60, max: 300, step: 1 },
};
type Take = { id: string; title: string };
type Cues = Record<string, number>;
type RecordOfMoment = {
  label: keyof typeof labels;
  note: string;
  tool: keyof typeof exercises;
  focus: string;
  span: [number, number];
  values: Partial<Record<keyof typeof targets, number>>;
  retry_cues?: Cues;
};
type RecordResponse = { revision: number; record: RecordOfMoment | null; cues: Cues };
type Retry = { text: string; receipt: string; cues: Cues; pace?: string | null };

export default function SpeakingCalibration() {
  const [takes, setTakes] = useState<Take[]>([]);
  const [take, chooseTake] = useState("");
  const [moments, setMoments] = useState<ReadoutSnippet[]>([]);
  const [snippet, chooseMoment] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void fetchTrainings().then(rows => {
      if (!rows) throw Error();
      if (active) setTakes(rows.filter(row => !row.deletion).flatMap(row => row.takes.map(t => ({
        id: t.sessionId, title: `${row.topic} · Take ${t.takeIndex}`,
      }))));
    }).catch(() => { if (active) setLoadError("Couldn’t load your Takes."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!take) return;
    let active = true;
    void fetchSessionReadout(take).then(result => {
      if (!result) throw Error();
      if (active) setMoments(result.readout.snippets.filter(row => row.audioRef && row.id && row.durationMs > 0));
    }).catch(() => { if (active) setLoadError("Couldn’t load moments from this Take."); });
    return () => { active = false; };
  }, [take]);
  const moment = moments.find(row => row.id === snippet);
  if (moment) return <Moment key={`${take}/${snippet}`} take={take} moment={moment} onBack={() => chooseMoment("")} />;
  return <Frame screen="training" title={title} composer={{ textDisabled: true }}>
    <Bubble>Choose a Take and the moment you want to calibrate.</Bubble>
    <label className="flex max-w-xl flex-col gap-1">Take
      <select className={input} value={take} onChange={event => {
        setLoadError(""); setMoments([]); chooseTake(event.target.value);
      }}>
        <option value="">Choose a Take</option>
        {takes.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
      </select>
    </label>
    {moments.map(row => <button key={row.id} className={choiceBubble(false)} onClick={() => chooseMoment(row.id)}>
      {time(row.startOffsetMs)}–{time(row.startOffsetMs + row.durationMs)} · {row.transcript.slice(0, 95)}
    </button>)}
    {loadError && <Bubble role="alert">{loadError}</Bubble>}
  </Frame>;
}

function time(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useAudio(blob: Blob | null) {
  const [src, set] = useState("");
  useEffect(() => {
    const url = blob ? URL.createObjectURL(blob) : "";
    set(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [blob]);
  return src;
}

function CueList({ cues }: { cues: Cues }) {
  return <ul className="text-sm">{Object.entries(cueNames).map(([name, label]) => (
    <li key={name}>{label} · {Number.isFinite(cues[name]) ? cues[name].toFixed(1) : "/"}</li>
  ))}</ul>;
}

function Moment({ take, moment, onBack }: { take: string; moment: ReadoutSnippet; onBack: () => void }) {
  const url = `/api/v2/user/speaking-calibration/${encodeURIComponent(take)}/${encodeURIComponent(moment.id)}`;
  const [record, setRecord] = useState<RecordResponse | null>(null);
  const [draft, setDraft] = useState<RecordOfMoment>({
    label: "unsure", tool: "none", note: "", focus: "", span: [0, moment.durationMs], values: {},
  });
  const [model, setModel] = useState<"standard" | "strong">("standard");
  const [retry, setRetry] = useState<Retry | null>(null);
  const [checked, setChecked] = useState(false);
  const [clip, setClip] = useState<Blob | null>(null);
  const [example, setExample] = useState<Blob | null>(null);
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const sniper = useRef(false);
  const activity = useRef<number | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const retrySrc = useAudio(clip);
  const exampleSrc = useAudio(example);
  useEffect(() => {
    let active = true;
    void bffFetch(url, { cache: "no-store" }).then(result => {
      if (result.kind !== "response" || !result.ok) throw Error();
      if (active) {
        const data = result.body as RecordResponse;
        setRecord(data);
        if (data.record) setDraft(data.record);
      }
    }).catch(() => { if (active) setNotice("Couldn’t open this calibration."); });
    return () => { active = false; };
  }, [url]);
  useEffect(() => { if (turns.length) bottom.current?.scrollIntoView?.({ block: "nearest" }); }, [turns]);
  useEffect(() => { if (retrySrc || exampleSrc) latest.current?.scrollIntoView?.({ block: "nearest" }); }, [retrySrc, exampleSrc]);

  const mic = useVoiceNote({
    maxSeconds: 25,
    onStream(stream) {
      if (!sniper.current) return;
      let active = true;
      let meter: PaceMic | undefined;
      void watchPaceStream(stream, read => { if (active) activity.current = read.activity; })
        .then(value => { if (active) meter = value; else value.stop(); }).catch(() => {});
      return () => { active = false; activity.current = null; meter?.stop(); };
    },
    onUnavailable: () => setNotice("Allow microphone access, then try again."),
    onDone: async ({ audio }) => {
      setClip(audio); setRetry(null); setExample(null); setChecked(false); setNotice("");
      const form = new FormData();
      form.append("audio", audio, audio.type.includes("mp4") ? "retry.m4a" :
        audio.type.includes("ogg") ? "retry.ogg" : "retry.webm");
      if (sniper.current) form.append("sniper", "1");
      try {
        const result = await bffFetch(url + "/coach", { method: "POST", body: form, timeoutMs: 55_000 });
        if (result.kind !== "response" || !result.ok) throw Error();
        setRetry(result.body as Retry);
      } catch {
        setNotice("Whisper couldn’t transcribe this retry. You can still play the recording.");
      }
    },
  });

  async function save() {
    if (!record || busy) return;
    setBusy(true); setNotice("");
    try {
      const result = await bffFetch(url, { method: "PUT", json: { revision: record.revision, record: draft, receipt: retry?.receipt } });
      if (result.kind !== "response" || !result.ok) {
        setNotice(result.kind === "response" && result.status === 409
          ? "This Take changed in another window. Reopen it before saving." : "Couldn’t save the calibration. Check the values and span.");
        return;
      }
      setRecord(result.body as RecordResponse);
      setNotice("Calibration saved for this moment.");
    } catch { setNotice("Couldn’t save the calibration."); }
    finally { setBusy(false); }
  }

  async function ask(question: string) {
    if (!record?.record || busy) return false;
    setBusy(true); setNotice("");
    try {
      const result = await bffFetch(url + "/coach", {
        method: "POST", timeoutMs: 55_000,
        json: { question, model, history: turns.slice(-4).flatMap(turn => [turn.question, turn.answer]), receipt: retry?.receipt, retry_text: checked ? retry?.text : undefined },
      });
      if (result.kind !== "response" || !result.ok) throw Error();
      const { reply } = result.body as { reply: string };
      if (!reply) throw Error();
      setTurns(previous => [...previous, { question, answer: reply }]);
      return true;
    } catch {
      setNotice("The calibration coach didn’t answer. Try again or choose the other model.");
      return false;
    } finally { setBusy(false); }
  }

  async function speak() {
    if (!retry || !checked || !draft.focus.trim() || busy || (retry.pace && retry.pace !== "comfortable")) return;
    setBusy(true); setNotice(""); setExample(null);
    try {
      const response = await fetch(url + "/coach", await withSessionBearer({
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(55_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "example", text: retry.text, focus: draft.focus, confirmed: checked, receipt: retry.receipt }),
      }));
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setNotice(typeof body.error === "string" ? body.error : "Couldn’t make the ElevenLabs example.");
        return;
      }
      if (!response.headers.get("content-type")?.startsWith("audio/")) throw Error();
      setExample(await response.blob());
    } catch { setNotice("Couldn’t make the ElevenLabs example."); }
    finally { setBusy(false); }
  }

  return <Frame screen="training" title={title} composer={{
    onSend: ask, textDisabled: !record?.record || busy || mic.phase !== "idle", maxLength: 1200,
    placeholder: record?.record ? "Ask about this moment or suggest a change" : "Save what you heard first",
  }}>
    <button className={choiceBubble(false)} onClick={onBack}>Choose another moment</button>
    <Bubble>{moment.transcript}
      <WalkPlayer label="original moment" seed={moment.id} src={moment.audioRef}
        startOffsetMs={moment.startOffsetMs} durationMs={moment.durationMs} look="bare" />
    </Bubble>
    <ObservationForm draft={draft} setDraft={setDraft} observed={Boolean(record?.record)}
      duration={moment.durationMs} disabled={!record || busy} save={save} />
    {record?.record && <>
      <Bubble><b>Vocal cues for the original clip</b><CueList cues={record.cues} /></Bubble>
      <ChoicePair name="calibration-model" value={model}
        options={[{ value: "standard", label: "GPT‑6.2 Sol" }, { value: "strong", label: "GPT‑6.2 Astra" }]}
        onPick={value => setModel(value === "strong" ? "strong" : "standard")} />
      {draft.tool === "sniper" && <Bubble>
        <p>{moment.transcript}</p>
        <PaceScale label="Sniper" className="h-12 max-w-md" asleep={mic.phase !== "recording"}
          activity={() => activity.current} />
      </Bubble>}
      <div className="flex flex-wrap gap-2">
        {mic.phase === "recording" ? <>
          <button className={choiceBubble(true)} onClick={mic.send}>Stop and transcribe</button>
          <button className={choiceBubble(false)} onClick={mic.cancel}>Cancel recording</button>
        </> : <button className={choiceBubble(false)} disabled={busy || mic.phase !== "idle"}
          onClick={() => {
            sniper.current = draft.tool === "sniper";
            document.querySelectorAll<HTMLAudioElement>("audio").forEach(player => player.pause());
            void mic.start();
          }}>{mic.phase === "sending" ? "Transcribing…" : draft.tool === "sniper" ? "Try Sniper" : "Record a retry"}</button>}
      </div>
      {retrySrc && <Bubble><WalkPlayer label="your retry" seed="calibration-retry" src={retrySrc} look="bare" /></Bubble>}
      {retry && <Bubble className="flex w-full max-w-2xl flex-col gap-2">
        <label className="flex flex-col gap-1">Retry transcript
          <textarea className={input} value={retry.text} maxLength={2000} disabled={busy}
            onChange={event => {
              setRetry({ ...retry, text: event.target.value }); setChecked(false); setExample(null);
            }} />
        </label>
        <CueList cues={retry.cues} />
        {retry.pace && <p>{retry.pace === "comfortable" ? "The pace of this retry is comfortable."
          : retry.pace === "unmeasured" ? "Say a little more so I can check your pace."
          : "Try the whole thought again at a comfortable pace."}</p>}
        <label><input type="checkbox" checked={checked} disabled={busy}
          onChange={event => setChecked(event.target.checked)} /> These are the words I said</label>
        <button className={choiceBubble(true)} disabled={!checked || !draft.focus.trim() || busy || Boolean(retry.pace && retry.pace !== "comfortable")}
          onClick={() => void speak()}>Make ElevenLabs example</button>
      </Bubble>}
      {!retry && record.record.retry_cues && <Bubble><b>Saved retry cues</b><CueList cues={record.record.retry_cues} /></Bubble>}
      {exampleSrc && <Bubble><WalkPlayer label="ElevenLabs example" seed="calibration-example" src={exampleSrc} look="bare" /></Bubble>}
      <div ref={latest} />
      <div role="log" aria-label="Calibration chat" className="flex flex-col gap-2">
        {turns.map((turn, index) => <div key={index} className="flex flex-col gap-2">
          <Bubble mine>{turn.question}</Bubble><Bubble>{turn.answer}</Bubble>
        </div>)}
      </div>
    </>}
    {notice && <Bubble role="status">{notice}</Bubble>}
    <div ref={bottom} />
  </Frame>;
}


function ObservationForm({ draft, setDraft, observed, duration, disabled, save }: {
  draft: RecordOfMoment;
  setDraft: Dispatch<SetStateAction<RecordOfMoment>>;
  observed: boolean;
  duration: number;
  disabled: boolean;
  save: () => Promise<void>;
}) {
  return (
    <fieldset className="flex max-w-2xl flex-col gap-2" disabled={disabled}>
      <legend className="font-semibold">What did you hear?</legend>
      <select className={input} aria-label="Human label" value={draft.label}
        onChange={event => setDraft(previous => ({ ...previous, label: event.target.value as keyof typeof labels }))}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <textarea className={input} aria-label="Listening note" placeholder="What would you change?" maxLength={1000}
        value={draft.note} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} />
      <div className="flex flex-wrap gap-2">
        {(["Start", "End"] as const).map((label, index) => (
          <label key={label} className="flex flex-col gap-1">{label} (seconds from clip start)
            <input className={input} type="number" step="0.001" min="0" max={duration / 1000}
              value={Number.isFinite(draft.span[index]) ? draft.span[index] / 1000 : ""}
              onChange={event => {
                const span: [number, number] = [...draft.span];
                span[index] = Math.round(event.target.valueAsNumber * 1000);
                setDraft(previous => ({ ...previous, span }));
              }} />
          </label>
        ))}
      </div>
      {observed && <>
        <label className="flex flex-col gap-1">Intervention
          <select className={input} value={draft.tool ?? "none"} onChange={event =>
            setDraft(previous => ({ ...previous, tool: event.target.value as keyof typeof exercises }))}>
            {Object.entries(exercises).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Words to emphasize
          <input className={input} value={draft.focus} maxLength={80}
            onChange={event => setDraft(previous => ({ ...previous, focus: event.target.value }))} />
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(targets).map(([name, target]) => {
            const key = name as keyof typeof targets;
            return <label key={key} className="flex flex-col gap-1">{target.name}
              <input className={input} type="number" min={target.min} max={target.max} step={target.step}
                value={draft.values[key] ?? ""} onChange={event => {
                  const value = event.target.valueAsNumber;
                  setDraft(previous => {
                    const values = { ...previous.values };
                    if (Number.isFinite(value)) values[key] = value;
                    else delete values[key];
                    return { ...previous, values };
                  });
                }} />
            </label>;
          })}
        </div>
      </>}
      <button className={choiceBubble(true)} onClick={() => void save()}>
        {observed ? "Save calibration" : "Save observation"}
      </button>
    </fieldset>
  );
}
