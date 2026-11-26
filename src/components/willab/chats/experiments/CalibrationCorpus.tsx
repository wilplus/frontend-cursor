"use client";

import { useState } from "react";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import WalkPlayer from "../../walk/WalkPlayer";
import { Bubble, choiceBubble } from "./bits";
import CalibrationCorpusUpload from "./CalibrationCorpusUpload";
import SpeakingPatternReview from "./SpeakingPatternReview";
import ClipTable from "./ClipTable";
import { clipTime, type CaseLink } from "./speakingPatterns";

/** The Training Corpus tab: import audio, then every corpus clip in the one
 *  table (backend N702). A row opens through `onOpen`. */
export function CalibrationCorpus({ onOpen }: { onOpen: (link: CaseLink) => void }) {
  const [upload, setUpload] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [importFailure, setImportFailure] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  if (upload) return <CalibrationCorpusUpload onBack={() => setUpload(false)} onComplete={(notice, failure) => {
    setImportNotice(notice); setImportFailure(failure);
    setUpload(false); setReload(value => value + 1);
  }} />;

  return <>
    <button type="button" className={choiceBubble(true)} onClick={() => setUpload(true)}>Import audio</button>
    {importNotice && <Bubble role="status">{importNotice}</Bubble>}
    {importFailure && <Bubble role="alert">{importFailure}</Bubble>}
    <ClipTable source="corpus" onOpen={onOpen} reload={reload} />
  </>;
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
