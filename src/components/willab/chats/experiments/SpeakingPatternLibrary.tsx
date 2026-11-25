"use client";

import { useEffect, useState } from "react";
import { Bubble, choiceBubble } from "./bits";
import { kindNames, patternInput, patternRequest, sourceNames, speakingPatternPath,
  type CaseLink, type LibraryPage, type PatternExample, type PatternKind, type PatternSource } from "./speakingPatterns";

export default function SpeakingPatternLibrary({ onOpen }: { onOpen: (clip: CaseLink) => void }) {
  const [rows, setRows] = useState<PatternExample[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [kind, setKind] = useState<PatternKind | "">("");
  const [source, setSource] = useState<PatternSource | "">("");
  const [query, setQuery] = useState("");
  const [load, setLoad] = useState(0);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const filters = new URLSearchParams({ offset: String(offset), kind, source, q: query });
    void patternRequest<LibraryPage>(speakingPatternPath + "?" + filters).then(result => {
      if (!active) return;
      setRows(result.examples); setNext(result.next_offset);
    }).catch(error => { if (active) setNotice(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [offset, source, kind, query, load]);

  function startPage(nextOffset: number) {
    setOffset(nextOffset); setRows([]); setNext(null); setBusy(true); setNotice(""); setLoad(load + 1);
  }

  return <>
    <Bubble>Open a saved pattern to hear the clip it came from and review its match.</Bubble>
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-1">Source
        <select className={patternInput} value={source} onChange={event => { setSource(event.target.value as typeof source); startPage(0); }}>
          <option value="">All sources</option>
          {Object.entries(sourceNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Label type
        <select className={patternInput} value={kind} onChange={event => { setKind(event.target.value as typeof kind); startPage(0); }}>
          <option value="">All labels</option>
          {Object.entries(kindNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        setQuery(String(new FormData(event.currentTarget).get("query") ?? "").trim());
        startPage(0);
      }}>
        <label className="flex flex-col gap-1">Pattern name<input className={patternInput} name="query" maxLength={100} /></label>
        <button type="submit" className={choiceBubble(false)}>Find patterns</button>
      </form>
    </div>
    {busy && <Bubble role="status">Opening the pattern library…</Bubble>}
    {notice && <Bubble role="alert">{notice}</Bubble>}
    {notice && <button className={choiceBubble(false)} onClick={() => startPage(offset)}>Try again</button>}
    {!busy && !notice && rows.length === 0 && <Bubble>No saved patterns on this page.</Bubble>}
    {rows.map(row => <article key={row.id} className="flex w-full max-w-2xl flex-col items-start gap-2 rounded-2xl border border-border p-4">
      <h3 className="font-semibold">{row.pattern}</h3>
      <p>{kindNames[row.kind]} · {sourceNames[row.source]}</p>
      {row.intervention && <p>{row.intervention.status === "approved" ? "Approved match" : "Draft match"} · {row.intervention.name}</p>}
      <button className={choiceBubble(false)} aria-label={`Open example for ${row.pattern}`} onClick={() => onOpen(row)}>Open example</button>
    </article>)}
    <div className="flex flex-wrap gap-2">
      {offset > 0 && <button className={choiceBubble(false)} onClick={() => startPage(Math.max(0, offset - 30))}>Previous page</button>}
      {next !== null && <button className={choiceBubble(false)} onClick={() => startPage(next)}>Next page</button>}
    </div>
  </>;
}
