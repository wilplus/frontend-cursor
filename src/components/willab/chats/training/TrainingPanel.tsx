"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { fetchTrainings } from "@/services/api/trainings";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { fetchConfidenceQueueResult, fetchTrainingImportsPage } from "@/services/api/trainingCorpus";
import WalkPlayer from "../../walk/WalkPlayer";
import CalibrationCorpusUpload from "./CalibrationCorpusUpload";
import PickerCheck from "./PickerCheck";
import ActIt from "./ActIt";
import { AiAudioScreen, RephraseScreen, SniperScreen } from "./ShapeFix";
import { InterventionReview } from "./InterventionReview";
import { Bubble, choiceBubble } from "./ui";
import { casePath, errorTools, looksLike, mistakeLine, mistakeProgress, pairsHint, patternInput, patternRequest, speakingPatternPath, suggestionsPath,
  type ActedListing, type CaseLink, type LibraryPage, type MistakeProgress, type PatternExample,
  type PatternResponse, type PatternSource, type RecordingSuggestions } from "./speakingPatterns";

/* The founder's Training (backend N704): one question per screen, for the
   two things the app learns. Screen 1, the moment picker: three clips of one
   recording, "Which one needs feedback?" or "None needs it". Screen 2, on an
   app Take, what that clip should get. On the corpus (N710), screen 2 is
   "Which mistake?": the label is the error's name. Each answer is a Pattern
   Library label, which the pickers' agreement check reads. */

export type Clip = CaseLink & { label: string; words: string; src: string | null; start: number; duration: number; acted?: boolean };
type ClipSet = { key: string; title: string; clips: Clip[] };
type View = "panel" | "past" | "import" | "mistakes";
type SuggestionState = { status: "measuring" | "ready"; body: RecordingSuggestions | null };
type LoadedSets = { id: string; sets: ClipSet[]; suggestions: Promise<RecordingSuggestions | null> | null };
const MEASURING = "Measuring\u2026";

/** Clips shown together, as on "Pick the moment for feedback". */
const SET_SIZE = 3;
/** Recordings read per step: each costs one read for its clips. */
const STEP = 6;
/** Pages of saved labels read to know what is done (30 each). */
const LABEL_PAGES = 20;
/** Fixes with a screen to shape them before they are kept (backend N705). */
export const SHAPED = ["sniper", "rewrite", "ai_audio"];
const TOOLS = [...Object.entries(errorTools).filter(([id]) => id !== "other"), ["nothing", "Nothing"]] as [string, string][];

const clipKey = (link: CaseLink) => `${link.session_id}|${link.snippet_id}`;

export async function savedLabels(source: PatternSource): Promise<PatternExample[]> {
  const rows: PatternExample[] = [];
  let offset: number | null = 0;
  for (let page = 0; offset !== null && page < LABEL_PAGES; page += 1) {
    const got: LibraryPage = await patternRequest<LibraryPage>(
      `${speakingPatternPath}?${new URLSearchParams({ offset: String(offset), source })}`);
    rows.push(...got.examples);
    offset = got.next_offset;
  }
  return rows;
}

async function recordings(source: PatternSource): Promise<{ id: string; title: string }[]> {
  if (source === "take") {
    const arcs = await fetchTrainings();
    if (!arcs) throw Error();
    return arcs.filter((arc) => !arc.deletion).flatMap((arc) =>
      arc.takes.map((take) => ({ id: take.sessionId, title: `${arc.topic} · Take ${take.takeIndex}` })));
  }
  const found: { id: string; title: string }[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await fetchTrainingImportsPage(offset);
    if (!page) throw Error();
    for (const row of page.imports) {
      if (row.state === "done" && row.setupComplete && !row.archivedAt) found.push({ id: row.sessionId, title: row.topic || "Corpus recording" });
    }
    offset = page.nextOffset;
  }
  return found;
}

async function setsOf(source: PatternSource, recording: { id: string; title: string }): Promise<LoadedSets> {
  const suggestions = null;
  let clips: Clip[] = [];
  if (source === "take") {
    const read = await fetchSessionReadout(recording.id);
    clips = (read?.readout.snippets ?? []).filter((c) => c.audioRef && c.id && c.durationMs > 0).map((c) => ({
      source, session_id: recording.id, snippet_id: c.id, label: "", words: c.transcript,
      src: c.audioRef, start: c.startOffsetMs, duration: c.durationMs,
    }));
  } else {
    const queue = await fetchConfidenceQueueResult(recording.id);
    clips = queue.ok ? queue.queue.queue.map((c) => ({
      source, session_id: recording.id, snippet_id: c.snippetId, label: "", words: "", src: null, start: 0, duration: 0,
    })) : [];
  }
  const sets: ClipSet[] = [];
  for (let at = 0; at < clips.length; at += SET_SIZE) {
    const part = clips.slice(at, at + SET_SIZE).map((c, i) => ({ ...c, label: `Clip ${"ABC"[i]}` }));
    sets.push({ key: `${recording.id}:${at}`, title: recording.title, clips: part });
  }
  return { id: recording.id, sets, suggestions };
}

/** A late measure from a source the founder has left is ignored. */
function showCached(
  found: LoadedSets[],
  gen: number,
  current: () => number,
  setSuggestions: Dispatch<SetStateAction<Record<string, SuggestionState>>>,
) {
  for (const item of found) {
    const session = item.sets[0]?.clips[0];
    if (!session || session.source !== "corpus") continue;
    const id = session.session_id;
    void patternRequest<RecordingSuggestions>(`${suggestionsPath(id)}?cached=1`).then((body) => {
      if (current() === gen && body.cached) setSuggestions((was) => ({ ...was, [id]: { status: "ready", body } }));
    }).catch(() => undefined);
  }
}

function clipHint(clip: Clip, state: SuggestionState | undefined): string | null {
  if (clip.source !== "corpus" || clip.acted) return null;
  if (!state) return null;
  if (state.status === "measuring") return MEASURING;
  return looksLike(state.body?.suggestions?.[clip.snippet_id]);
}

function suggestedName(clip: Clip | null, state: SuggestionState | undefined): string {
  if (!clip || clip.source !== "corpus" || state?.status !== "ready") return "";
  return state.body?.suggestions?.[clip.snippet_id]?.pattern ?? "";
}

const emptyBundle = (id: string): LoadedSets => ({ id, sets: [], suggestions: null });

/** A corpus clip's player: its window comes from the corpus read. */
function CorpusPlayer({ clip, onWindow }: { clip: Clip; onWindow: (duration: number) => void }) {
  const { clip: read, error, onMediaError } = useCorpusClip(clip.snippet_id);
  useEffect(() => { if (read?.durationMs) onWindow(read.durationMs); }, [read, onWindow]);
  if (error) return <span className="text-sm text-muted-foreground">{error}</span>;
  if (!read?.src) return <span className="text-sm text-muted-foreground">Opening…</span>;
  return <WalkPlayer seed={clip.snippet_id} src={read.src} startOffsetMs={read.startOffsetMs}
    durationMs={read.durationMs} label={clip.label} look="bare" onError={onMediaError} />;
}

export function ClipCard({ clip, chosen, onPick, onWindow, hint }: {
  clip: Clip; chosen: boolean; onPick?: () => void; onWindow: (key: string, duration: number) => void; hint?: string | null;
}) {
  return <div data-train-clip={clip.snippet_id}
    className={`flex flex-col gap-2 rounded-2xl border p-3 ${chosen ? "border-primary bg-primary/10" : "border-border"}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold">{clip.label}</span>
      {onPick ? <button type="button" className={choiceBubble(chosen)} onClick={onPick}>This one</button> : null}
    </div>
    {clip.source === "take" || clip.acted
      ? <WalkPlayer seed={clip.snippet_id} src={clip.src} startOffsetMs={clip.start} durationMs={clip.duration} label={clip.label} look="bare" />
      : <CorpusPlayer clip={clip} onWindow={(d) => onWindow(clipKey(clip), d)} />}
    {hint ? <p data-train-hint="" className="m-0 text-[14px] text-muted-foreground">{hint}</p> : null}
    {clip.words ? <p className="m-0 text-[15px] text-muted-foreground">“{clip.words.slice(0, 140)}”</p> : null}
  </div>;
}

export default function TrainingPanel() {
  const [source, setSource] = useState<PatternSource>("take");
  const [acting, setActing] = useState(false);
  const [view, setView] = useState<View>("panel");
  const [reload, setReload] = useState(0);
  const [recs, setRecs] = useState<{ id: string; title: string }[] | null>(null);
  const [read, setRead] = useState(0);
  const [sets, setSets] = useState<ClipSet[]>([]);
  const [labels, setLabels] = useState<PatternExample[]>([]);
  const [picked, setPicked] = useState<Clip | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [shaping, setShaping] = useState<string[] | null>(null);
  const [windows, setWindows] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionState>>({});
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    setRecs(null); setSets([]); setRead(0); setPicked(null); setChosen([]); setShaping(null);
    setSuggestions({}); setNames([]); setBusy(true); setNotice("");
    void Promise.all([recordings(source), savedLabels(source).catch(() => [] as PatternExample[])])
      .then(([found, saved]) => { if (active) { setRecs(found); setLabels(saved); } })
      .catch(() => { if (active) { setNotice("Couldn’t load the recordings. Try again."); setBusy(false); } });
    return () => { active = false; };
  }, [source, reload]);

  const done = useMemo(() => new Set(labels.map(clipKey)), [labels]);
  const open = sets.filter((s) => !s.clips.some((c) => done.has(clipKey(c))));

  // Read more recordings while fewer than two sets are waiting.
  useEffect(() => {
    if (!recs || read >= recs.length || open.length >= 2) { if (recs) setBusy(false); return; }
    let active = true;
    setBusy(true);
    const next = recs.slice(read, read + STEP);
    const gen = generation.current;
    void Promise.all(next.map((r) => setsOf(source, r).catch(() => emptyBundle(r.id))))
      .then((found) => {
        if (!active) return;
        setSets((was) => [...was, ...found.flatMap((item) => item.sets)]);
        setRead((n) => n + next.length);
        showCached(found, gen, () => generation.current, setSuggestions);
      });
    return () => { active = false; };
  }, [recs, read, open.length, source]);

  useEffect(() => {
    if (source !== "corpus" || !picked) return;
    let active = true;
    void patternRequest<ActedListing>(`${speakingPatternPath}/acted`)
      .then((got) => { if (active) setNames(got.names ?? []); })
      .catch(() => { if (active) setNames([]); });
    return () => { active = false; };
  }, [source, picked]);

  const current = picked ? null : open[0] ?? null;
  const emptyLine = emptyLineOf(source, recs?.length ?? 0, sets.length);
  const left = open.length + (recs && read < recs.length ? "+" : "");
  const durationOf = (clip: Clip) => clip.duration || windows[clipKey(clip)] || 0;
  const onWindow = (key: string, duration: number) =>
    setWindows((was) => (was[key] === duration ? was : { ...was, [key]: duration }));

  async function label(clip: Clip, kind: "error" | "control", tool?: string, shape: Record<string, unknown> = {}) {
    const duration = durationOf(clip);
    if (!duration) throw Error("This clip has no playback window yet.");
    const saved = await patternRequest<PatternResponse>(casePath(clip), "POST", {
      kind, pattern: kind === "error" ? "Needs feedback" : "Nothing needed", start_ms: 0, end_ms: duration, note: "",
    });
    const mine = saved.examples[saved.examples.length - 1];
    if (kind === "error" && tool && tool !== "nothing" && mine) {
      await patternRequest(casePath(clip), "PUT", { example_id: mine.id, intervention: {
        tool, name: errorTools[tool as keyof typeof errorTools], delivery: "", status: "approved", ...shape,
      } });
    }
    return mine;
  }

  async function save(work: () => Promise<(PatternExample | undefined)[]>): Promise<boolean> {
    setSaving(true); setNotice("");
    try {
      const added = (await work()).filter((row): row is PatternExample => Boolean(row));
      setLabels((was) => [...added, ...was]);
      return true;
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : "Couldn’t save. Try again.");
      return false;
    } finally { setSaving(false); }
  }

  const finish = () => { setPicked(null); setChosen([]); setShaping(null); };
  const hintFor = (clip: Clip) => clipHint(clip, suggestions[clip.session_id]);
  function measure(sessionId: string) {
    const gen = generation.current;
    setSuggestions((was) => ({ ...was, [sessionId]: { status: "measuring", body: null } }));
    void patternRequest<RecordingSuggestions>(suggestionsPath(sessionId)).then((body) => {
      if (generation.current === gen) setSuggestions((was) => ({ ...was, [sessionId]: { status: "ready", body } }));
    }).catch(() => {
      if (generation.current === gen) setSuggestions((was) => {
        const next = { ...was };
        delete next[sessionId];
        return next;
      });
    });
  }
  async function saveNamed(clip: Clip, pattern: string) {
    const duration = durationOf(clip);
    if (!duration) throw Error("This clip has no playback window yet.");
    const saved = await patternRequest<PatternResponse>(casePath(clip), "POST", {
      kind: "error", pattern, start_ms: 0, end_ms: duration, note: "corpus",
    });
    return saved.examples[saved.examples.length - 1];
  }
  const toggleTool = (id: string) => setChosen((was) => {
    if (id === "nothing") return was.includes("nothing") ? [] : ["nothing"];
    const rest = was.filter((tool) => tool !== "nothing");
    return rest.includes(id) ? rest.filter((tool) => tool !== id) : [...rest, id];
  });
  // Plain fixes are kept at once; Sniper and Rephrase are shaped first, one screen each.
  async function goOn(clip: Clip) {
    const plain = chosen.filter((tool) => !SHAPED.includes(tool));
    if (!await save(() => Promise.all(plain.map((tool) => label(clip, "error", tool))))) return;
    const next = chosen.filter((tool) => SHAPED.includes(tool));
    if (next.length) setShaping(next); else finish();
  }
  async function keepShape(clip: Clip, tool: string, shape: Record<string, unknown>) {
    if (!await save(async () => [await label(clip, "error", tool, shape)])) return;
    setShaping((was) => {
      const rest = (was ?? []).filter((t) => t !== tool);
      if (!rest.length) { setPicked(null); setChosen([]); return null; }
      return rest;
    });
  }

  if (view === "import") {
    return <section className="flex flex-col gap-3 p-4">
      <CalibrationCorpusUpload onBack={() => setView("panel")} onComplete={(line, failure) => {
        setNotice(failure ?? line); setView("panel"); setReload((n) => n + 1);
      }} />
    </section>;
  }
  if (view === "past") {
    return <PastAnswers source={source} labels={labels} onBack={() => setView("panel")}
      onUndone={(id) => setLabels((was) => was.filter((row) => row.id !== id))} />;
  }
  if (view === "mistakes") return <YourMistakes onBack={() => setView("panel")} />;

  const switcher = <div className="flex gap-2">
    {(["take", "corpus"] as const).map((id) => <button key={id} type="button" aria-pressed={!acting && source === id}
      className={choiceBubble(!acting && source === id)} onClick={() => { setActing(false); setSource(id); }}>{id === "take" ? "App Takes" : "Corpus"}</button>)}
    <button type="button" data-train-act="" aria-pressed={acting} className={choiceBubble(acting)}
      onClick={() => setActing(true)}>Act it</button>
  </div>;
  if (acting) {
    return <section data-training-panel="" className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      {switcher}
      <ActIt />
    </section>;
  }

  function questions() {
    return <>
      {source === "corpus" && current && !suggestions[current.clips[0].session_id]
        ? <button type="button" className={`${choiceBubble(true)} self-start`}
          onClick={() => measure(current.clips[0].session_id)}>Measure</button> : null}
      {current ? <WhichOne set={current} saving={saving} onWindow={onWindow} onPick={setPicked} hintFor={hintFor}
        onNone={() => void save(() => Promise.all(current.clips.map((clip) => label(clip, "control"))))} /> : null}
      {picked && source === "corpus" ? <WhichMistake clip={picked} suggested={suggestedName(picked, suggestions[picked.session_id])}
        names={names} saving={saving} hint={hintFor(picked)} onWindow={onWindow} onBack={finish}
        onSave={(pattern) => void save(async () => [await saveNamed(picked, pattern)]).then((ok) => { if (ok) finish(); })} /> : null}
      {picked && source === "take" && !shaping ? <WhatItGets clip={picked} chosen={chosen} saving={saving} onWindow={onWindow}
        onToggle={toggleTool} onContinue={() => void goOn(picked)} onBack={finish} /> : null}
      {picked && shaping?.[0] ? <ShapeStep tool={shaping[0]} clip={{ ...picked, duration: durationOf(picked) }}
        onBack={() => setShaping(null)} onKeep={(tool, shape) => void keepShape(picked, tool, shape)} /> : null}
      {!current && !picked && busy ? <Bubble role="status">Loading clips…</Bubble> : null}
      {!current && !picked && !busy && !notice ? <Bubble data-train-empty="">{emptyLine}</Bubble> : null}
      {notice ? <Bubble role="alert">{notice}</Bubble> : null}
    </>;
  }

  return <section data-training-panel="" className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      {switcher}
      <span data-train-left="" className="text-[15px] text-muted-foreground">{`${left} left`}</span>
    </div>
    {questions()}
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <PickerCheck key={labels.length} />
      <div className="flex flex-wrap gap-4 text-[15px]">
        <button type="button" className="underline" onClick={() => setView("past")}>Your past answers</button>
        <button type="button" className="underline" onClick={() => setView("mistakes")}>Your mistakes</button>
        {source === "corpus" ? <button type="button" className="underline" onClick={() => setView("import")}>Import audio</button> : null}
      </div>
    </div>
  </section>;
}

/** The screen that shapes one fix (N705, N706), and what it keeps. */
export function ShapeStep({ tool, clip, onBack, onKeep }: {
  tool: string; clip: Clip; onBack: () => void; onKeep: (tool: string, shape: Record<string, unknown>) => void;
}) {
  const wpm = (value?: number) => (value ? { values: { wpm: value } } : {});
  if (tool === "sniper") return <SniperScreen key="sniper" clip={clip} onBack={onBack}
    onKeep={(shape) => onKeep("sniper", { marks: { speed: shape.speed, pauses: shape.pauses }, ...wpm(shape.wpm) })} />;
  if (tool === "ai_audio") return <AiAudioScreen key="ai_audio" clip={clip} onBack={onBack}
    onKeep={(shape) => onKeep("ai_audio", { ...(shape.text ? { text: shape.text } : {}), ...wpm(shape.wpm) })} />;
  return <RephraseScreen key="rewrite" clip={clip} onBack={onBack} onKeep={(shape) => onKeep("rewrite", shape)} />;
}

/** Which empty it is: nothing found, nothing playable, or all answered. */
function emptyLineOf(source: PatternSource, found: number, sets: number): string {
  const take = source === "take";
  if (!found) return take ? "No Takes found in your active projects." : "No corpus recordings are ready yet. Import audio below.";
  if (!sets) return take ? `Found ${found} Takes, but none has playable clips yet.` : `Found ${found} corpus recordings, but none has clips yet.`;
  return take ? "Every clip of your Takes has an answer." : "Every corpus clip has an answer.";
}

function WhichOne({ set, saving, onWindow, onPick, onNone, hintFor }: {
  set: ClipSet; saving: boolean; onWindow: (key: string, duration: number) => void;
  onPick: (clip: Clip) => void; onNone: () => void; hintFor?: (clip: Clip) => string | null;
}) {
  return <>
    <h2 className="m-0 text-[20px] font-semibold">Which one needs feedback?</h2>
    <p className="m-0 text-[14px] text-muted-foreground">{set.title}</p>
    {set.clips.map((clip) => <ClipCard key={clipKey(clip)} clip={clip} chosen={false} hint={hintFor?.(clip)}
      onPick={() => onPick(clip)} onWindow={onWindow} />)}
    <button type="button" className={`${choiceBubble(false)} self-start`} disabled={saving} onClick={onNone}>None needs it</button>
  </>;
}

/** Corpus screen 2 (N710): the suggestion is chosen, or the founder names it. */
export function WhichMistake({ clip, suggested, names, saving, hint, onWindow, onSave, onBack }: {
  clip: Clip; suggested: string; names: string[]; saving: boolean; hint: string | null;
  onWindow: (key: string, duration: number) => void; onSave: (pattern: string) => void; onBack: () => void;
}) {
  const [name, setName] = useState(suggested);
  const [own, setOwn] = useState("");
  const touched = useRef(false);
  useEffect(() => { if (!touched.current && suggested) setName(suggested); }, [suggested]);
  const choices = suggested && !names.includes(suggested) ? [suggested, ...names] : names;
  const pick = (next: string, typed = "") => { touched.current = true; setOwn(typed); setName(next); };
  return <>
    <h2 className="m-0 text-[20px] font-semibold">Which mistake?</h2>
    <ClipCard clip={clip} chosen hint={hint} onWindow={onWindow} />
    {choices.length ? <div className="flex flex-wrap gap-2">
      {choices.map((n) => <button key={n} type="button" data-mistake-name={n} aria-pressed={name === n}
        className={choiceBubble(name === n)} disabled={saving} onClick={() => pick(n)}>{n}</button>)}
    </div> : null}
    <input aria-label="Your own name" placeholder="Your own name" maxLength={100} value={own} className={patternInput}
      onChange={(event) => pick(event.target.value, event.target.value)} />
    <div className="flex flex-wrap gap-2">
      <button type="button" data-train-continue="" className={choiceBubble(true)} disabled={saving || !name.trim()}
        onClick={() => onSave(name.trim())}>Continue</button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </>;
}

/** How many pairs and corpus labels each error name has (N710 item 4). */
function YourMistakes({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<MistakeProgress[] | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      patternRequest<ActedListing>(`${speakingPatternPath}/acted`),
      savedLabels("corpus").catch(() => [] as PatternExample[]),
    ]).then(([acted, saved]) => { if (active) setRows(mistakeProgress(acted, saved)); })
      .catch(() => { if (active) setNotice("Couldn’t load the recordings. Try again."); });
    return () => { active = false; };
  }, []);
  const hint = rows ? pairsHint(rows) : null;
  return <section data-your-mistakes="" className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
    <button type="button" className="self-start text-[15px] underline" onClick={onBack}>Back</button>
    <h2 className="m-0 text-[20px] font-semibold">Your mistakes</h2>
    {hint ? <p data-pairs-hint="" className="m-0 text-[14px] text-muted-foreground">{hint}</p> : null}
    {rows?.map((row) => <div key={row.name} data-mistake={row.name} className="border-b border-border py-2">{mistakeLine(row)}</div>)}
    {notice ? <Bubble role="alert">{notice}</Bubble> : null}
  </section>;
}

export function WhatItGets({ clip, chosen, saving, onWindow, onToggle, onContinue, onBack, tools = TOOLS, title = "What should it get?" }: {
  clip: Clip; chosen: string[]; saving: boolean; onWindow: (key: string, duration: number) => void;
  onToggle: (id: string) => void; onContinue: () => void; onBack: () => void;
  tools?: [string, string][]; title?: string;
}) {
  return <>
    <h2 className="m-0 text-[20px] font-semibold">{title}</h2>
    <p className="m-0 text-[14px] text-muted-foreground">Pick one or more.</p>
    <ClipCard clip={clip} chosen onWindow={onWindow} />
    <div className="flex flex-wrap gap-2">
      {tools.map(([id, name]) => <button key={id} type="button" data-train-tool={id} aria-pressed={chosen.includes(id)}
        className={choiceBubble(chosen.includes(id))} disabled={saving} onClick={() => onToggle(id)}>{name}</button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" data-train-continue="" className={choiceBubble(true)} disabled={saving || !chosen.length}
        onClick={onContinue}>Continue</button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </>;
}

/** A named pattern with no tool is the name alone. "Needs feedback" keeps its tool,
 *  and Nothing still reads "Needs feedback · Nothing". */
function RightWay({ clip, pattern }: { clip: CaseLink; pattern: string }) {
  const [line, setLine] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [heard, setHeard] = useState<{ audio: string; content_type: string; kept_by: "generated" | "voice" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function ask(path: string, take: (got: { line?: string; audio?: string | null; voice?: string | null }) => void) {
    setBusy(true); setNotice("");
    try {
      const got = await patternRequest<{ line?: string; audio?: string | null; voice?: string | null; error?: string }>(
        `${casePath(clip)}/${path}`, "POST", { pattern, score: 1 });
      setLine(got.line ?? "");
      take(got);
    } catch (caught) {
      setNotice(caught instanceof Error && caught.message ? caught.message : "Couldn’t open or save the pattern library. Try again.");
    } finally { setBusy(false); }
  }
  const original = { ...clip, label: "", words: "", src: null, start: 0, duration: 0 };
  return <div data-right-way="" className="flex flex-col gap-2 py-2">
    <ClipCard clip={original} chosen={false} onWindow={() => undefined} />
    <div className="flex flex-wrap gap-2">
      <button type="button" className={choiceBubble(true)} disabled={busy} onClick={() => void ask("right-way", (got) => {
        setSrc(got.audio ? `data:audio/wav;base64,${got.audio}` : null);
        setVoice(null);
        setHeard(got.audio ? { audio: got.audio, content_type: "audio/wav", kept_by: "generated" } : null);
        if (!got.audio) setNotice("The cues of these recordings could not be measured yet.");
      })}>Generate the right way</button>
      <button type="button" className={choiceBubble(false)} disabled={busy} onClick={() => { setVoice(null); void ask("in-their-voice", (got) => {
        setVoice(got.voice ? `data:audio/mpeg;base64,${got.voice}` : null);
        if (got.voice) setHeard({ audio: got.voice, content_type: "audio/mpeg", kept_by: "voice" });
      }); }}>In their voice</button>
    </div>
    {line ? <p className="m-0 text-[15px]">{line}</p> : null}
    {src ? <audio data-right-audio="" controls src={src} className="w-full" /> : null}
    {voice ? <audio data-their-voice="" controls src={voice} className="w-full" /> : null}
    {line || heard ? <InterventionReview clip={clip} pattern={pattern} line={line} heard={heard} /> : null}
    {notice ? <Bubble role="status">{notice}</Bubble> : null}
  </div>;
}

function pastLine(row: PatternExample): string {
  if (row.kind === "control") return "None needs it";
  if (row.kind !== "error") return row.pattern;
  const tool = row.intervention ? errorTools[row.intervention.tool as keyof typeof errorTools] ?? row.intervention.name : "";
  if (row.pattern === "Needs feedback") return `Needs feedback · ${tool || "Nothing"}`;
  return tool ? `${row.pattern} · ${tool}` : row.pattern;
}

export function PastAnswers({ source, labels, onBack, onUndone, empty }: {
  source: PatternSource; empty?: string; labels: PatternExample[]; onBack: () => void; onUndone: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  return <section data-past-answers="" className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
    <button type="button" className="self-start text-[15px] underline" onClick={onBack}>Back</button>
    <h2 className="m-0 text-[20px] font-semibold">Your past answers</h2>
    {labels.length === 0 ? <Bubble>{empty ?? (source === "take" ? "No answers on your Takes yet." : "No answers on the corpus yet.")}</Bubble> : null}
    {labels.map((row) => <div key={row.id} data-past-row={row.id} className="border-b border-border py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">{pastLine(row)}</span>
        <button type="button" className={choiceBubble(false)} onClick={() => void patternRequest(casePath(row), "DELETE", { example_id: row.id })
          .then(() => onUndone(row.id)).catch(() => setNotice("Couldn’t undo. Try again."))}>Undo</button>
      </div>
      {source === "corpus" && row.kind === "error" && row.pattern !== "Needs feedback" ? <RightWay clip={row} pattern={row.pattern} /> : null}
    </div>)}
    {notice ? <Bubble role="alert">{notice}</Bubble> : null}
  </section>;
}
