"use client";

import { useEffect, useMemo, useState } from "react";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { fetchTrainings } from "@/services/api/trainings";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { fetchConfidenceQueueResult, fetchTrainingImportsPage } from "@/services/api/trainingCorpus";
import WalkPlayer from "../../walk/WalkPlayer";
import CalibrationCorpusUpload from "./CalibrationCorpusUpload";
import PickerCheck from "./PickerCheck";
import { RephraseScreen, SniperScreen } from "./ShapeFix";
import { Bubble, choiceBubble } from "./ui";
import { casePath, errorTools, patternRequest, speakingPatternPath,
  type CaseLink, type LibraryPage, type PatternExample, type PatternResponse, type PatternSource } from "./speakingPatterns";

/* The founder's Training (backend N704): one question per screen, for the
   two things the app learns. Screen 1, the moment picker: three clips of one
   recording, "Which one needs feedback?" or "None needs it". Screen 2, the
   intervention picker: what that clip should get. Each answer is a Pattern
   Library label (an error with its tool, or a control), which the pickers'
   agreement check reads. */

type Clip = CaseLink & { label: string; words: string; src: string | null; start: number; duration: number };
type ClipSet = { key: string; title: string; clips: Clip[] };
type View = "panel" | "past" | "import";

/** Clips shown together, as on "Pick the moment for feedback". */
const SET_SIZE = 3;
/** Recordings read per step: each costs one read for its clips. */
const STEP = 6;
/** Pages of saved labels read to know what is done (30 each). */
const LABEL_PAGES = 20;
/** Fixes with a screen to shape them before they are kept (backend N705). */
const SHAPED = ["sniper", "rewrite"];
const TOOLS = [...Object.entries(errorTools).filter(([id]) => id !== "other"), ["nothing", "Nothing"]] as [string, string][];

const clipKey = (link: CaseLink) => `${link.session_id}|${link.snippet_id}`;

async function savedLabels(source: PatternSource): Promise<PatternExample[]> {
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

async function setsOf(source: PatternSource, recording: { id: string; title: string }): Promise<ClipSet[]> {
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
  return sets;
}

/** A corpus clip's player: its window comes from the corpus read. */
function CorpusPlayer({ clip, onWindow }: { clip: Clip; onWindow: (duration: number) => void }) {
  const { clip: read, error, onMediaError } = useCorpusClip(clip.snippet_id);
  useEffect(() => { if (read?.durationMs) onWindow(read.durationMs); }, [read, onWindow]);
  if (error) return <span className="text-sm text-muted-foreground">{error}</span>;
  if (!read?.src) return <span className="text-sm text-muted-foreground">Opening…</span>;
  return <WalkPlayer seed={clip.snippet_id} src={read.src} startOffsetMs={read.startOffsetMs}
    durationMs={read.durationMs} label={clip.label} look="bare" onError={onMediaError} />;
}

function ClipCard({ clip, chosen, onPick, onWindow }: {
  clip: Clip; chosen: boolean; onPick?: () => void; onWindow: (key: string, duration: number) => void;
}) {
  return <div data-train-clip={clip.snippet_id}
    className={`flex flex-col gap-2 rounded-2xl border p-3 ${chosen ? "border-primary bg-primary/10" : "border-border"}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold">{clip.label}</span>
      {onPick ? <button type="button" className={choiceBubble(chosen)} onClick={onPick}>This one</button> : null}
    </div>
    {clip.source === "take"
      ? <WalkPlayer seed={clip.snippet_id} src={clip.src} startOffsetMs={clip.start} durationMs={clip.duration} label={clip.label} look="bare" />
      : <CorpusPlayer clip={clip} onWindow={(d) => onWindow(clipKey(clip), d)} />}
    {clip.words ? <p className="m-0 text-[15px] text-muted-foreground">“{clip.words.slice(0, 140)}”</p> : null}
  </div>;
}

export default function TrainingPanel() {
  const [source, setSource] = useState<PatternSource>("take");
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
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setRecs(null); setSets([]); setRead(0); setPicked(null); setChosen([]); setShaping(null); setBusy(true); setNotice("");
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
    void Promise.all(next.map((r) => setsOf(source, r).catch(() => [] as ClipSet[])))
      .then((found) => { if (active) { setSets((was) => [...was, ...found.flat()]); setRead((n) => n + next.length); } });
    return () => { active = false; };
  }, [recs, read, open.length, source]);

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

  return <section data-training-panel="" className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        {(["take", "corpus"] as const).map((id) => <button key={id} type="button" aria-pressed={source === id}
          className={choiceBubble(source === id)} onClick={() => setSource(id)}>{id === "take" ? "App Takes" : "Corpus"}</button>)}
      </div>
      <span data-train-left="" className="text-[15px] text-muted-foreground">{`${left} left`}</span>
    </div>

    {current ? <WhichOne set={current} saving={saving} onWindow={onWindow} onPick={setPicked}
      onNone={() => void save(() => Promise.all(current.clips.map((clip) => label(clip, "control"))))} /> : null}

    {picked && !shaping ? <WhatItGets clip={picked} chosen={chosen} saving={saving} onWindow={onWindow}
      onToggle={toggleTool} onContinue={() => void goOn(picked)} onBack={finish} /> : null}

    {picked && shaping?.[0] === "sniper" ? <SniperScreen key="sniper" clip={{ ...picked, duration: durationOf(picked) }}
      onBack={() => setShaping(null)} onKeep={(shape) => void keepShape(picked, "sniper", {
        marks: { speed: shape.speed, pauses: shape.pauses }, ...(shape.wpm ? { values: { wpm: shape.wpm } } : {}),
      })} /> : null}
    {picked && shaping?.[0] === "rewrite" ? <RephraseScreen key="rewrite" clip={picked}
      onBack={() => setShaping(null)} onKeep={(shape) => void keepShape(picked, "rewrite", shape)} /> : null}

    {!current && busy ? <Bubble role="status">Loading clips…</Bubble> : null}
    {!current && !busy && !notice ? <Bubble data-train-empty="">{emptyLine}</Bubble> : null}
    {notice ? <Bubble role="alert">{notice}</Bubble> : null}

    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <PickerCheck key={labels.length} />
      <div className="flex flex-wrap gap-4 text-[15px]">
        <button type="button" className="underline" onClick={() => setView("past")}>Your past answers</button>
        {source === "corpus" ? <button type="button" className="underline" onClick={() => setView("import")}>Import audio</button> : null}
      </div>
    </div>
  </section>;
}

/** Which empty it is: nothing found, nothing playable, or all answered. */
function emptyLineOf(source: PatternSource, found: number, sets: number): string {
  const take = source === "take";
  if (!found) return take ? "No Takes found in your active projects." : "No corpus recordings are ready yet. Import audio below.";
  if (!sets) return take ? `Found ${found} Takes, but none has playable clips yet.` : `Found ${found} corpus recordings, but none has clips yet.`;
  return take ? "Every clip of your Takes has an answer." : "Every corpus clip has an answer.";
}

function WhichOne({ set, saving, onWindow, onPick, onNone }: {
  set: ClipSet; saving: boolean; onWindow: (key: string, duration: number) => void;
  onPick: (clip: Clip) => void; onNone: () => void;
}) {
  return <>
    <h2 className="m-0 text-[20px] font-semibold">Which one needs feedback?</h2>
    <p className="m-0 text-[14px] text-muted-foreground">{set.title}</p>
    {set.clips.map((clip) => <ClipCard key={clipKey(clip)} clip={clip} chosen={false}
      onPick={() => onPick(clip)} onWindow={onWindow} />)}
    <button type="button" className={`${choiceBubble(false)} self-start`} disabled={saving} onClick={onNone}>None needs it</button>
  </>;
}

function WhatItGets({ clip, chosen, saving, onWindow, onToggle, onContinue, onBack }: {
  clip: Clip; chosen: string[]; saving: boolean; onWindow: (key: string, duration: number) => void;
  onToggle: (id: string) => void; onContinue: () => void; onBack: () => void;
}) {
  return <>
    <h2 className="m-0 text-[20px] font-semibold">What should it get?</h2>
    <p className="m-0 text-[14px] text-muted-foreground">Pick one or more.</p>
    <ClipCard clip={clip} chosen onWindow={onWindow} />
    <div className="flex flex-wrap gap-2">
      {TOOLS.map(([id, name]) => <button key={id} type="button" data-train-tool={id} aria-pressed={chosen.includes(id)}
        className={choiceBubble(chosen.includes(id))} disabled={saving} onClick={() => onToggle(id)}>{name}</button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" data-train-continue="" className={choiceBubble(true)} disabled={saving || !chosen.length}
        onClick={onContinue}>Continue</button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </>;
}

function PastAnswers({ source, labels, onBack, onUndone }: {
  source: PatternSource; labels: PatternExample[]; onBack: () => void; onUndone: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  const answer = (row: PatternExample) => row.kind === "control" ? "None needs it"
    : row.kind === "error" ? `Needs feedback · ${row.intervention ? errorTools[row.intervention.tool as keyof typeof errorTools] ?? row.intervention.name : "Nothing"}`
    : row.pattern;
  return <section data-past-answers="" className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
    <button type="button" className="self-start text-[15px] underline" onClick={onBack}>Back</button>
    <h2 className="m-0 text-[20px] font-semibold">Your past answers</h2>
    {labels.length === 0 ? <Bubble>{source === "take" ? "No answers on your Takes yet." : "No answers on the corpus yet."}</Bubble> : null}
    {labels.map((row) => <div key={row.id} data-past-row={row.id} className="flex items-center justify-between gap-3 border-b border-border py-2">
      <span className="min-w-0">{answer(row)}</span>
      <button type="button" className={choiceBubble(false)} onClick={() => void patternRequest(casePath(row), "DELETE", { example_id: row.id })
        .then(() => onUndone(row.id)).catch(() => setNotice("Couldn’t undo. Try again."))}>Undo</button>
    </div>)}
    {notice ? <Bubble role="alert">{notice}</Bubble> : null}
  </section>;
}
