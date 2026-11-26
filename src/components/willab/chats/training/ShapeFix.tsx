"use client";

import { useEffect, useRef, useState } from "react";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { Bubble, choiceBubble } from "./ui";
import { casePath, patternRequest, type CaseLink } from "./speakingPatterns";

/* The screens that shape one fix before it is kept (backend N705):
   Sniper, the pace and where the pauses go; Rephrase, the better words. */

export type ShapeClip = CaseLink & { label: string; words: string; src: string | null; start: number; duration: number };
export type SniperShape = { speed: number; pauses: number[]; wpm?: number };
export type RephraseShape = { text: string; suggested: string };

const SPEEDS = { min: 0.6, max: 1.4, step: 0.05 };

/** The clip's playable window: a Take's from its read, a corpus clip's from the corpus read. */
function useWindow(clip: ShapeClip) {
  const corpus = useCorpusClip(clip.source === "corpus" ? clip.snippet_id : null);
  if (clip.source === "take") return { src: clip.src, start: clip.start, duration: clip.duration };
  const read = corpus.clip;
  return { src: read?.src ?? null, start: read?.startOffsetMs ?? 0, duration: read?.durationMs ?? 0 };
}

/** Plays the clip's window at a speed, the voice's pitch kept. */
function SpeedPlayer({ src, start, duration, speed }: { src: string | null; start: number; duration: number; speed: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.playbackRate = speed;
    (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [speed]);
  const play = () => {
    const el = audio.current;
    if (!el || !src) return;
    el.currentTime = start / 1000;
    el.playbackRate = speed;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return <div className="flex items-center gap-3">
    <audio ref={audio} src={src ?? undefined} preload="auto"
      onTimeUpdate={(event) => {
        const el = event.currentTarget;
        if (el.currentTime * 1000 >= start + duration) { el.pause(); setPlaying(false); }
      }}
      onPause={() => setPlaying(false)} />
    <button type="button" data-speed-play="" className={choiceBubble(playing)} disabled={!src} onClick={play}>
      {playing ? "Playing…" : "Play at this speed"}
    </button>
  </div>;
}

export function SniperScreen({ clip, onKeep, onBack }: {
  clip: ShapeClip; onKeep: (shape: SniperShape) => void; onBack: () => void;
}) {
  const clipWindow = useWindow(clip);
  const [speed, setSpeed] = useState(1);
  const [pauses, setPauses] = useState<number[]>([]);
  const [words, setWords] = useState(clip.words);
  useEffect(() => {
    if (clip.words) return;
    let active = true;
    void patternRequest<{ words: string }>(`${casePath(clip)}/words`)
      .then((got) => { if (active) setWords(got.words); }).catch(() => undefined);
    return () => { active = false; };
  }, [clip]);
  const list = words.split(/\s+/).filter(Boolean);
  const toggle = (at: number) => setPauses((was) => (was.includes(at) ? was.filter((n) => n !== at) : [...was, at].sort((a, b) => a - b)));
  const keep = () => {
    const minutes = clipWindow.duration / 60000;
    const wpm = minutes > 0 && list.length ? Math.round((list.length / minutes) * speed) : 0;
    onKeep({ speed: Math.round(speed * 100) / 100, pauses, ...(wpm >= 60 && wpm <= 300 ? { wpm } : {}) });
  };
  return <div data-shape="sniper" className="flex flex-col gap-3">
    <h2 className="m-0 text-[20px] font-semibold">Sniper: find the right pace</h2>
    <SpeedPlayer src={clipWindow.src} start={clipWindow.start} duration={clipWindow.duration} speed={speed} />
    <label className="flex flex-col gap-1 text-[15px]">
      <input type="range" aria-label="Speed" min={SPEEDS.min} max={SPEEDS.max} step={SPEEDS.step} value={speed}
        onChange={(event) => setSpeed(Number(event.target.value))} />
      <span className="flex justify-between text-muted-foreground"><span>slower</span><span>{`${Math.round(speed * 100)}%`}</span><span>faster</span></span>
    </label>
    {list.length ? <>
      <p className="m-0 text-[15px] text-muted-foreground">Tap between words where a pause should go.</p>
      <p data-sniper-words="" className="m-0 text-[17px] leading-loose">
        {list.map((word, at) => <span key={at}>
          {word}
          {at < list.length - 1 ? <button type="button" data-pause-after={at} aria-pressed={pauses.includes(at)}
            aria-label={`Pause after ${word}`} onClick={() => toggle(at)}
            className={`mx-1 inline-block h-4 w-4 rounded align-middle ${pauses.includes(at) ? "bg-primary" : "border border-border"}`} /> : null}
          {" "}
        </span>)}
      </p>
    </> : <Bubble>This clip has no words yet, so only the pace is kept.</Bubble>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={choiceBubble(true)} onClick={keep}>Keep</button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </div>;
}

export function RephraseScreen({ clip, onKeep, onBack }: {
  clip: ShapeClip; onKeep: (shape: RephraseShape) => void; onBack: () => void;
}) {
  const [said, setSaid] = useState(clip.words);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void patternRequest<{ words: string; rewrite: string | null }>(`${casePath(clip)}/rewrite`)
      .then((got) => {
        if (!active) return;
        setSaid(got.words || clip.words);
        setSuggested(got.rewrite);
        setText(got.rewrite ?? got.words ?? clip.words);
        if (!got.rewrite) setNotice("No suggestion this time. Write the better words yourself.");
      })
      .catch(() => { if (active) { setText(clip.words); setNotice("Couldn’t get a suggestion. Write the better words yourself."); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [clip]);
  return <div data-shape="rewrite" className="flex flex-col gap-3">
    <h2 className="m-0 text-[20px] font-semibold">Rephrase: is this the better wording?</h2>
    {said ? <p className="m-0 text-[15px] text-muted-foreground">{`They said: “${said}”`}</p> : null}
    {busy ? <Bubble role="status">Writing a better version…</Bubble> : <>
      <textarea aria-label="Better wording" value={text} maxLength={1000} rows={3}
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[16px]" />
      {notice ? <p className="m-0 text-[14px] text-muted-foreground">{notice}</p> : null}
    </>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={choiceBubble(true)} disabled={busy || !text.trim()}
        onClick={() => onKeep({ text: text.trim(), suggested: suggested ?? "" })}>
        {suggested && text.trim() === suggested ? "Accept" : "Keep"}
      </button>
      <button type="button" className={choiceBubble(false)} onClick={onBack}>Back</button>
    </div>
  </div>;
}
