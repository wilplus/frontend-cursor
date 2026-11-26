"use client";

import { useEffect, useState } from "react";
import { fetchTrainings } from "@/services/api/trainings";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { fetchConfidenceQueueResult, fetchTrainingImportsPage } from "@/services/api/trainingCorpus";
import { Bubble, choiceBubble } from "./bits";
import { clipTime, kindNames, patternRequest, speakingPatternPath,
  type CaseLink, type LibraryPage, type PatternKind, type PatternSource } from "./speakingPatterns";

/* The one table (backend N702): every clip of your Takes, or of the Training
   Corpus, one row each, with whether you have labelled it. A row opens that
   clip's labeling: the moment, its kind, and the intervention. */

type Row = CaseLink & { group: string; when: string; words: string };
type Group = { id: string; title: string };

/** Recordings read per step: each costs one read for its clips. */
const STEP = 8;
/** Pages of saved labels read for the status column (30 each). */
const LABEL_PAGES = 20;

const keyOf = (link: CaseLink) => `${link.session_id}|${link.snippet_id}`;

async function labelled(source: PatternSource): Promise<Map<string, PatternKind[]>> {
  const found = new Map<string, PatternKind[]>();
  let offset: number | null = 0;
  for (let page = 0; offset !== null && page < LABEL_PAGES; page += 1) {
    const result: LibraryPage = await patternRequest<LibraryPage>(
      `${speakingPatternPath}?${new URLSearchParams({ offset: String(offset), source })}`);
    for (const row of result.examples) found.set(keyOf(row), [...(found.get(keyOf(row)) ?? []), row.kind]);
    offset = result.next_offset;
  }
  return found;
}

async function groupsOf(source: PatternSource): Promise<Group[]> {
  if (source === "take") {
    const arcs = await fetchTrainings();
    if (!arcs) throw Error();
    return arcs.filter((arc) => !arc.deletion).flatMap((arc) => arc.takes.map((take) => ({
      id: take.sessionId, title: `${arc.topic} · Take ${take.takeIndex}`,
    })));
  }
  const groups: Group[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await fetchTrainingImportsPage(offset);
    if (!page) throw Error();
    for (const row of page.imports) {
      if (row.state === "done" && row.setupComplete && !row.archivedAt) {
        groups.push({ id: row.sessionId, title: row.topic || "Corpus recording" });
      }
    }
    offset = page.nextOffset;
  }
  return groups;
}

async function rowsOf(source: PatternSource, group: Group): Promise<Row[]> {
  if (source === "take") {
    const result = await fetchSessionReadout(group.id);
    if (!result) return [];
    return result.readout.snippets
      .filter((clip) => clip.audioRef && clip.id && clip.durationMs > 0)
      .map((clip) => ({
        source, session_id: group.id, snippet_id: clip.id, group: group.title,
        when: `${clipTime(clip.startOffsetMs)}–${clipTime(clip.startOffsetMs + clip.durationMs)}`,
        words: clip.transcript.slice(0, 90),
      }));
  }
  const result = await fetchConfidenceQueueResult(group.id);
  if (!result.ok) return [];
  return result.queue.queue.map((clip, index) => ({
    source, session_id: group.id, snippet_id: clip.snippetId, group: group.title,
    when: `Clip ${index + 1}`, words: "",
  }));
}

export default function ClipTable({ source, onOpen, reload = 0 }: {
  source: PatternSource; onOpen: (link: CaseLink) => void; reload?: number;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [shown, setShown] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Map<string, PatternKind[]>>(new Map());
  const [todo, setTodo] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setGroups(null); setRows([]); setShown(0); setBusy(true); setNotice("");
    void Promise.all([groupsOf(source), labelled(source).catch(() => new Map<string, PatternKind[]>())])
      .then(([found, saved]) => { if (active) { setGroups(found); setLabels(saved); } })
      .catch(() => { if (active) { setNotice("Couldn’t load the clips. Try again."); setBusy(false); } });
    return () => { active = false; };
  }, [source, reload]);

  useEffect(() => {
    if (!groups) return;
    const next = groups.slice(shown, shown + STEP);
    if (!next.length) { setBusy(false); return; }
    let active = true;
    setBusy(true);
    void Promise.all(next.map((group) => rowsOf(source, group).catch(() => [] as Row[])))
      .then((found) => { if (active) setRows((was) => [...was, ...found.flat()]); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [groups, shown, source]);

  const visible = todo ? rows.filter((row) => !labels.has(keyOf(row))) : rows;
  const more = groups !== null && shown + STEP < groups.length;
  return <div data-clip-table={source} className="flex w-full flex-col gap-2">
    <label className="flex items-center gap-2 text-[15px]">
      <input type="checkbox" checked={todo} onChange={(event) => setTodo(event.target.checked)} />
      Only clips not labelled yet
    </label>
    <table className="w-full max-w-3xl border-collapse text-left text-[15px]">
      <thead><tr className="border-b border-border text-muted-foreground">
        <th className="py-2 pr-3 font-medium">Recording</th>
        <th className="py-2 pr-3 font-medium">Clip</th>
        <th className="py-2 pr-3 font-medium">Label</th>
        <th className="py-2" />
      </tr></thead>
      <tbody>
        {visible.map((row) => {
          const kinds = labels.get(keyOf(row));
          return <tr key={keyOf(row)} data-clip-row={row.snippet_id} className="border-b border-border align-top">
            <td className="py-2 pr-3">{row.group}</td>
            <td className="py-2 pr-3">{row.when}{row.words ? <span className="block text-muted-foreground">{row.words}</span> : null}</td>
            <td className="py-2 pr-3">{kinds ? [...new Set(kinds)].map((kind) => kindNames[kind]).join(", ") : "Not labelled"}</td>
            <td className="py-2"><button type="button" className={choiceBubble(false)}
              aria-label={`Label ${row.group} ${row.when}`} onClick={() => onOpen(row)}>Label</button></td>
          </tr>;
        })}
      </tbody>
    </table>
    {busy && <Bubble role="status">Loading clips…</Bubble>}
    {notice && <Bubble role="alert">{notice}</Bubble>}
    {!busy && !notice && visible.length === 0 && <Bubble>No clips to label here yet.</Bubble>}
    {more && !busy && <button type="button" className={choiceBubble(false)}
      onClick={() => setShown((was) => was + STEP)}>Load more recordings</button>}
  </div>;
}
