"use client";

import { useEffect, useState } from "react";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { fetchConfidenceQueueResult, fetchTrainingImportsPage, type TrainingImport } from "@/services/api/trainingCorpus";
import WalkPlayer from "../../walk/WalkPlayer";
import { Bubble, choiceBubble } from "./bits";
import SpeakingPatternReview from "./SpeakingPatternReview";
import { clipTime, patternInput, type CaseLink } from "./speakingPatterns";

export function CalibrationCorpus() {
  const [moment, openMoment] = useState<CaseLink | null>(null);
  const [imports, setImports] = useState<TrainingImport[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [listBusy, setListBusy] = useState(true);
  const [listError, setListError] = useState("");
  const [session, setSession] = useState("");
  const [pieces, setPieces] = useState<string[] | null>(null);
  const [queueError, setQueueError] = useState("");
  useEffect(() => {
    let active = true;
    void fetchTrainingImportsPage(0).then(page => {
      if (!page) throw Error();
      if (!active) return;
      setImports(readyImports(page.imports)); setNext(page.nextOffset);
    }).catch(() => { if (active) setListError("Couldn’t load the Training Corpus."); })
      .finally(() => { if (active) setListBusy(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchConfidenceQueueResult(session).then(result => {
      if (!active) return;
      if (!result.ok) { setQueueError(result.error); return; }
      setPieces(result.queue.queue.map(row => row.snippetId));
    }).catch(() => { if (active) setQueueError("Couldn’t load clips from this recording."); });
    return () => { active = false; };
  }, [session]);

  async function loadMore() {
    if (next === null || listBusy) return;
    setListError(""); setListBusy(true);
    try {
      const page = await fetchTrainingImportsPage(next);
      if (!page) throw Error();
      setImports(previous => [...previous, ...readyImports(page.imports)]);
      setNext(page.nextOffset);
    } catch { setListError("Couldn’t load the Training Corpus."); }
    finally { setListBusy(false); }
  }

  if (moment) return <CorpusMoment link={moment} backLabel="Back to clips" onBack={() => openMoment(null)} />;

  return <>
    <Bubble>Choose a corpus recording and listen to one clip at a time.</Bubble>
    <label className="flex w-full max-w-xl flex-col gap-1">Corpus recording
      <select className={patternInput} value={session} onChange={event => {
        setPieces(null); setQueueError(""); setSession(event.target.value);
      }}>
        <option value="">Choose a recording</option>
        {imports.map(row => <option key={row.sessionId} value={row.sessionId}>{row.topic || "Corpus recording"}</option>)}
      </select>
    </label>
    {next !== null && !listBusy && <button className={choiceBubble(false)} onClick={() => void loadMore()}>
      {listError ? "Try again" : "Load more recordings"}</button>}
    {listBusy && <Bubble role="status">Loading corpus recordings…</Bubble>}
    {listError && <Bubble role="alert">{listError}</Bubble>}
    {!listBusy && !listError && next === null && imports.length === 0 && <Bubble>No corpus recordings are ready to review.</Bubble>}
    {session && !pieces && !queueError && <Bubble role="status">Loading clips…</Bubble>}
    {queueError && <Bubble role="alert">{queueError}</Bubble>}
    {pieces?.length === 0 && <Bubble>No clips are available for this recording.</Bubble>}
    <div className="flex flex-wrap gap-2">
      {pieces?.map((snippetId, index) => <button key={snippetId} className={choiceBubble(false)}
        onClick={() => openMoment({ source: "corpus", session_id: session, snippet_id: snippetId })}>Listen to clip {index + 1}</button>)}
    </div>
  </>;
}

function readyImports(imports: TrainingImport[]) {
  return imports.filter(row => row.state === "done" && row.setupComplete && !row.archivedAt);
}

export function CorpusMoment({ link, backLabel, onBack }: { link: CaseLink; backLabel: string; onBack: () => void }) {
  const { clip, error, onMediaError } = useCorpusClip(link.snippet_id);
  return <>
    <button className={choiceBubble(false)} onClick={onBack}>{backLabel}</button>
    {error && <Bubble role="alert">{error}</Bubble>}
    {!clip && !error && <Bubble role="status">Opening corpus clip…</Bubble>}
    {clip?.src && clip.durationMs > 0 && <CorpusReview link={link} src={clip.src}
      start={clip.startOffsetMs} duration={clip.durationMs} onError={onMediaError} />}
    {clip && (!clip.src || clip.durationMs <= 0) && <Bubble>This clip has no exact playback window.</Bubble>}
  </>;
}

function CorpusReview({ link, src, start, duration, onError }: {
  link: CaseLink; src: string; start: number; duration: number; onError: () => void;
}) {
  return <>
    <Bubble className="w-full max-w-2xl">
      <p>Corpus clip · {clipTime(start)}–{clipTime(start + duration)}</p>
      <WalkPlayer label="corpus moment" seed={link.snippet_id} src={src}
        startOffsetMs={start} durationMs={duration} look="bare" onError={onError} />
    </Bubble>
    <SpeakingPatternReview clip={link} start={start} duration={duration} />
  </>;
}
