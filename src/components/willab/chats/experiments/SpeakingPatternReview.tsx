"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Bubble, choiceBubble } from "./bits";
import {
  casePath, clipTime, deliveryTargets, errorTools, kindNames, patternInput, patternRequest, praiseTools, starterPatterns, startingMatch, toolName,
  type CaseLink, type DeliveryValues, type Match, type Observation, type PatternExample, type PatternKind, type PatternResponse,
} from "./speakingPatterns";

const cues: Record<string, string> = {
  wpm: "Words per minute", f0_mean: "Average pitch (Hz)", f0_sd: "Pitch variation (Hz)",
  pause_ratio: "Pause share", opening_contrast_db: "Opening loudness contrast (dB)",
};

export default function SpeakingPatternReview({ clip, duration, start }: {
  clip: CaseLink; duration: number; start: number;
}) {
  const [data, setData] = useState<PatternResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const url = casePath(clip);
  useEffect(() => {
    let active = true;
    void patternRequest<PatternResponse>(url)
      .then(result => { if (active) setData(result); })
      .catch(error => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [url, reload]);

  async function save(method: "POST" | "PUT" | "DELETE", body: object) {
    if (busy) return false;
    setBusy(true); setNotice("");
    try {
      setData(await patternRequest<PatternResponse>(url, method, body));
      setNotice(method === "DELETE" ? "Example removed." : "Saved to the pattern library.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t save this example.");
      return false;
    } finally { setBusy(false); }
  }

  return <section aria-label="Pattern labels" className="flex flex-col gap-3">
    <Bubble>Listen to the whole clip. Label what needs work or what worked well. You can add more than one label.</Bubble>
    {clip.source === "corpus" && <Bubble>Corpus recordings are examples. You can save a match here, and retry results are only available for Takes you practise.</Bubble>}
    {data && <>
      <ObservationForm duration={duration} disabled={busy} save={body => save("POST", body)} />
      {data.examples.length > 0 && <Bubble>
        <strong>Vocal cues for the whole clip</strong>
        <ul>{Object.entries(cues).map(([key, label]) => <li key={key}>{label} · {data.cues[key]?.toFixed(2) ?? "Unmeasured"}</li>)}</ul>
      </Bubble>}
      {data.examples.map(example => <Example key={example.id} example={example} start={start} busy={busy}
        save={intervention => save("PUT", { example_id: example.id, intervention })}
        remove={() => save("DELETE", { example_id: example.id })} />)}
    </>}
    {notice && <Bubble role="status">{notice}</Bubble>}
    {!data && notice && <button className={choiceBubble(false)} onClick={() => { setNotice(""); setReload(reload + 1); }}>Try again</button>}
    {!data && !notice && <Bubble role="status">Opening pattern labels…</Bubble>}
  </section>;
}

function ObservationForm({ duration, disabled, save }: {
  duration: number; disabled: boolean; save: (body: Observation) => Promise<boolean>;
}) {
  const form = useId();
  const [kind, setKind] = useState<PatternKind>("error");
  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState(String(duration / 1000));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await save({ kind, pattern, note, start_ms: Math.round(Number(start) * 1000), end_ms: Math.round(Number(end) * 1000) })) {
      setPattern(""); setNote(""); setStart("0"); setEnd(String(duration / 1000));
    }
  }
  return <form onSubmit={submit} className="w-full max-w-2xl">
    <fieldset disabled={disabled} className="flex flex-col gap-3">
      <legend className="mb-2 font-semibold">Add a listening label</legend>
      <label className="flex flex-col gap-1">Label type
        <select className={patternInput} value={kind} onChange={event => {
          const next = event.target.value as PatternKind;
          setKind(next); setPattern(next === "unsure" ? "Unsure" : "");
        }}>
          {Object.entries(kindNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Pattern
        <select className={patternInput} value={starterPatterns[kind].includes(pattern) ? pattern : ""}
          onChange={event => setPattern(event.target.value)}>
          <option value="">Choose a starter pattern</option>
          {starterPatterns[kind].map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Pattern name
        <input className={patternInput} required maxLength={100} value={pattern}
          placeholder="Use a starter pattern or name your own" onChange={event => setPattern(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <label htmlFor={form + "-start"} className="flex flex-col gap-1">Start (seconds into clip)
          <input className={patternInput} id={form + "-start"} type="number" required step="0.001" min={0} max={duration / 1000}
            value={start} onChange={event => setStart(event.target.value)} />
        </label>
        <label htmlFor={form + "-end"} className="flex flex-col gap-1">End (seconds into clip)
          <input className={patternInput} id={form + "-end"} type="number" required step="0.001" min={0.001} max={duration / 1000}
            value={end} onChange={event => setEnd(event.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1">What did you hear?
        <textarea className={patternInput} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
          placeholder="For example, the last phrase speeds up, or a particular expression makes the point clearer" />
      </label>
      <button type="submit" className={choiceBubble(true)}>Save listening label</button>
    </fieldset>
  </form>;
}

function Example({ example, start, busy, save, remove }: {
  example: PatternExample; start: number; busy: boolean;
  save: (match: Match | null) => Promise<boolean>; remove: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const assignable = example.kind === "error" || example.kind === "praise";
  return <article className="flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-border p-4">
    <p><strong>{example.pattern}</strong> · {kindNames[example.kind]} · {clipTime(start + example.start_ms)}–{clipTime(start + example.end_ms)}</p>
    {example.note && <p className="whitespace-pre-wrap break-words">{example.note}</p>}
    {assignable && <p>{example.intervention
      ? `${example.intervention.status === "approved" ? "Approved match" : "Draft match"} · ${toolName(example.kind, example.intervention.tool)} · ${example.intervention.name}`
      : "Intervention match open"}</p>}
    {example.intervention?.delivery && <p className="whitespace-pre-wrap break-words">{example.intervention.delivery}</p>}
    {Object.entries(example.intervention?.values ?? {}).map(([name, value]) =>
      <p key={name}>{deliveryTargets[name as keyof DeliveryValues].name} · {value}</p>)}
    {editing
      ? <MatchForm example={example} busy={busy} save={async match => { if (await save(match)) setEditing(false); }}
          close={() => setEditing(false)} />
      : <div className="flex flex-wrap gap-2">
          {assignable && <button className={choiceBubble(false)} disabled={busy} onClick={() => setEditing(true)}>
            {example.intervention ? "Edit intervention pattern" : "Assign intervention pattern"}</button>}
          <button className={choiceBubble(false)} disabled={busy} onClick={() => setConfirmRemoval(!confirmRemoval)}>
            {confirmRemoval ? "Cancel removal" : "Remove label"}</button>
          {confirmRemoval && <button className={choiceBubble(false)} disabled={busy} onClick={() => void remove()}>Confirm removal</button>}
        </div>}
  </article>;
}

function MatchForm({ example, busy, save, close }: {
  example: PatternExample; busy: boolean; save: (match: Match | null) => Promise<void>; close: () => void;
}) {
  const [match, setMatch] = useState<Match>(() => startingMatch(example));
  const tools = example.kind === "praise" ? praiseTools : errorTools;
  return <form onSubmit={event => { event.preventDefault(); void save(match); }}>
    <fieldset className="flex flex-col gap-3" disabled={busy}>
      <legend className="mb-2 font-semibold">{example.kind === "praise" ? "Praise intervention pattern" : "Error intervention pattern"}</legend>
      <label className="flex flex-col gap-1">Intervention
        <select className={patternInput} required value={match.tool} onChange={event => setMatch({ ...match, tool: event.target.value })}>
          <option value="">Choose an intervention</option>
          {Object.entries(tools).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Intervention pattern name
        <input className={patternInput} required maxLength={100} value={match.name}
          onChange={event => setMatch({ ...match, name: event.target.value })} />
      </label>
      <label className="flex flex-col gap-1">What should the speaker hear or do?
        <textarea className={patternInput} maxLength={1000} value={match.delivery}
          onChange={event => setMatch({ ...match, delivery: event.target.value })} />
      </label>
      {example.kind === "error" && <MatchValues values={match.values ?? {}} onChange={values => setMatch({ ...match, values })} />}
      <label><input type="checkbox" checked={match.status === "approved"}
        onChange={event => setMatch({ ...match, status: event.target.checked ? "approved" : "draft" })} /> Approve this match</label>
      <div className="flex flex-wrap gap-2">
        <button className={choiceBubble(true)} type="submit">Save intervention pattern</button>
        <button className={choiceBubble(false)} type="button" onClick={close}>Cancel</button>
        {example.intervention && <button className={choiceBubble(false)} type="button" onClick={() => void save(null)}>Clear match</button>}
      </div>
    </fieldset>
  </form>;
}


function MatchValues({ values, onChange }: { values: DeliveryValues; onChange: (values: DeliveryValues) => void }) {
  return <details className="rounded-xl border border-border p-3">
    <summary className="cursor-pointer">Optional delivery values</summary>
    <div className="mt-2 flex flex-wrap gap-3">
      {(Object.keys(deliveryTargets) as (keyof DeliveryValues)[]).map(key => {
        const target = deliveryTargets[key];
        return <label className="flex flex-col gap-1" key={key}>{target.name}
          <input className={patternInput} type="number" min={target.min} max={target.max} step={target.step}
            value={values[key] ?? ""} onChange={event => {
              const next = { ...values };
              if (event.target.value === "") delete next[key];
              else next[key] = event.target.valueAsNumber;
              onChange(next);
            }} />
        </label>;
      })}
    </div>
  </details>;
}
