"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { fetchTakeTranscript } from "@/services/api/takeTranscript";
import { useBackDismiss } from "./useBackDismiss";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ReadoutPayload } from "./readout";

export default function TakeTranscriptSheet({
  projectTopic,
  takeIndex,
  takeSessionId,
  onClose,
}: {
  projectTopic: string;
  takeIndex: number;
  takeSessionId: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [transcript, setTranscript] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [readout, setReadout] = useState<ReadoutPayload | null>(null);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("time");
  const [playing, setPlaying] = useState<number | null>(null);
  const normalize = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const thoughts = (readout?.timedThoughts ?? []).filter(t => normalize(t.text).includes(normalize(query)));
  const rate = (t: typeof thoughts[number]) => t.text.trim().split(/\s+/).length / (t.end - t.start);
  if (order !== "time") thoughts.sort((a,b) => (rate(b)-rate(a)) * (order === "fast" ? 1 : -1));
  const audio = readout?.parentAudioRef ?? readout?.snippets.find(s => s.audioRef)?.audioRef;
  useBackDismiss(onClose);

  useEffect(() => {
    let active = true;
    setState("loading");
    setTranscript("");
    setReadout(null);
    setQuery("");
    setPlaying(null);
    void fetchTakeTranscript(takeSessionId, data => { if (active) setReadout(data); }).then(
      (text) => {
        if (!active) return;
        setTranscript(text);
        setState("ready");
      },
      () => {
        if (active) setState("error");
      },
    );
    return () => {
      active = false;
    };
  }, [takeSessionId, retryKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-0 sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Close transcript" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-[24px] bg-background shadow-xl sm:rounded-[24px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] text-muted-foreground">Raw transcript</p>
            <h2 id={titleId} className="truncate text-[17px] font-semibold text-foreground">
              {projectTopic} · Take {takeIndex}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close transcript" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div aria-live="polite" className="scrollbar-none min-h-[160px] overflow-y-auto px-5 py-5">
          {state === "loading" ? <p className="text-[15px] text-muted-foreground">Loading transcript…</p> : null}
          {state === "error" ? (
            <div className="space-y-2">
              <p className="text-[15px] text-destructive">We couldn&apos;t load this transcript.</p>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="text-[14px] text-foreground underline underline-offset-2">
                Try again
              </button>
            </div>
          ) : null}
          {state === "ready" ? (
            readout?.timedThoughts?.length ? (
              <div className="space-y-3">
                <input aria-label="Find a thought" placeholder="Find a thought" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border p-3" />
                <select aria-label="Thought order" value={order} onChange={e => setOrder(e.target.value)}>
                  <option value="time">Recording order</option><option value="fast">Fastest first</option><option value="slow">Slowest first</option>
                </select>
                {thoughts.map(t => <div key={t.start} className="rounded-2xl bg-muted p-3">
                  <p>{t.text}</p>
                  {audio && (playing === t.start ? <MediaPlayer key={t.start} src={audio} startOffsetMs={t.start} durationMs={t.end-t.start} compact /> :
                    <button type="button" onClick={() => setPlaying(t.start)}>Play thought</button>)}
                </div>)}
                {!thoughts.length && <p>No matching thought.</p>}
                <details><summary>Full transcript</summary><p className="whitespace-pre-wrap">{transcript}</p></details>
              </div>
            ) : transcript ? (
              <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-foreground">{transcript}</p>
            ) : (
              <p className="text-[15px] text-muted-foreground">This Take has no transcript yet.</p>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
