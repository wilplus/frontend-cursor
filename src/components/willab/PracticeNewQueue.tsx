"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, CircleHelp, Minus, Pause, Play, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import LoadingState from "./LoadingState";
import {
  fetchPracticeQueue,
  savePracticeAnswer,
  type PracticeAnswer,
  type PracticeClip,
} from "@/services/api/voiceAlbumPractice";

/* -------------------------------------------------------------------------- */
/*  "Practice new" — one clip per screen (founder 2026-09-18: "this should not */
/*  be on scroll but like a game one per screen").                            */
/*                                                                            */
/*  The card is the Take review's judgement card, deliberately unchanged: the  */
/*  same question, the same five answers, the same three-then-two layout. A    */
/*  second visual language for the same instrument would make the two          */
/*  surfaces feel like two different questions.                                */
/*                                                                            */
/*  No project headings. The founder cut them: "no title here everything one   */
/*  by one." The queue is still ordered by project underneath.                 */
/*                                                                            */
/*  AC-9: nothing here reports a score, a machine read or a verdict. The star  */
/*  that selected the clip is never shown — the user is being asked, not told. */
/* -------------------------------------------------------------------------- */

const PRIMARY: { value: PracticeAnswer; label: string; Icon: typeof Check }[] = [
  { value: "yes", label: "Yes", Icon: Check },
  { value: "in_between", label: "In-between", Icon: Minus },
  { value: "no", label: "No", Icon: X },
];

const SECONDARY: { value: PracticeAnswer; label: string; Icon: typeof Check }[] = [
  { value: "not_sure", label: "Not sure", Icon: CircleHelp },
  { value: "audio_unclear", label: "Audio unclear", Icon: VolumeX },
];

export default function PracticeNewQueue() {
  const [clips, setClips] = useState<PracticeClip[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Answers kept per clip so stepping back shows what you chose. */
  const [answers, setAnswers] = useState<Record<string, PracticeAnswer>>({});

  useEffect(() => {
    let active = true;
    void fetchPracticeQueue().then((result) => {
      if (!active) return;
      setClips(result?.mine ?? null);
      setStatus(result ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, []);

  const answer = useCallback(
    async (clip: PracticeClip, value: PracticeAnswer) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      const ok = await savePracticeAnswer(clip, value);
      setSaving(false);
      if (!ok) {
        setError("Couldn't save that answer. Try again.");
        return;
      }
      setAnswers((current) => ({ ...current, [clip.snippetId]: value }));
      setIndex((current) => current + 1);
    },
    [saving]
  );

  if (status === "loading") return <LoadingState placement="surface" />;

  if (status === "error" || !clips) {
    return (
      <Centered>
        <p className="m-0 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          We couldn&apos;t load your practice clips just now.
        </p>
      </Centered>
    );
  }

  if (clips.length === 0 || index >= clips.length) {
    return (
      <Centered>
        <h2 className="m-0 text-balance font-heading text-[28px] font-normal leading-tight">
          That&apos;s everything for now
        </h2>
        <p className="m-0 max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground">
          New recordings appear here after your next Take.
        </p>
      </Centered>
    );
  }

  const clip = clips[index];
  const chosen = answers[clip.snippetId];

  return (
    <>
      <div className="h-[2px] bg-border" aria-hidden>
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: `${(index / clips.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-[22px] px-1 pb-9 pt-5">
        <article key={clip.snippetId} className="flex flex-col gap-[18px]">
          <ClipBar clip={clip} />

          <p className="m-0 text-balance text-[17px] font-semibold tracking-tight">
            Does this sound confident to you?
          </p>

          <div className="grid grid-cols-3 gap-3">
            {PRIMARY.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                disabled={saving}
                onClick={() => void answer(clip, value)}
                className={cn(
                  "flex min-h-[88px] flex-col items-center justify-center gap-2.5 rounded-xl border px-1.5 py-3.5 text-[15px] font-semibold tracking-tight transition-colors disabled:opacity-60",
                  chosen === value
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-foreground"
                )}
              >
                <Icon className="h-[21px] w-[21px]" aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
            Other
          </div>

          <div className="flex flex-col gap-3">
            {SECONDARY.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                disabled={saving}
                onClick={() => void answer(clip, value)}
                className={cn(
                  "flex min-h-[58px] w-full items-center gap-3 rounded-xl border px-[18px] py-[15px] text-left text-[16px] transition-colors disabled:opacity-60",
                  chosen === value
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {error ? (
            <p className="m-0 text-[13px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </article>

        <div className="flex min-h-5 items-center justify-center">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIndex((current) => Math.max(0, current - 1));
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Previous
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-1 py-10 text-center">
      {children}
    </div>
  );
}

/* The Take review's player: an outlined button, a hairline track that fills
   across THIS clip's span, and the time left. */
function ClipBar({ clip }: { clip: PracticeClip }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [errored, setErrored] = useState(false);

  const seekSec = (clip.startOffsetMs ?? 0) / 1000;
  const total =
    typeof clip.durationMs === "number" && clip.durationMs > 0
      ? clip.durationMs / 1000
      : mediaDuration;
  const endSec = seekSec + total;
  const disabled = !clip.audioUrl || errored;

  useEffect(() => {
    setErrored(false);
    setElapsed(0);
    setMediaDuration(0);
    setPlaying(false);
  }, [clip.snippetId]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || disabled) return;
    if (playing) {
      el.pause();
      return;
    }
    if (el.currentTime < seekSec || el.currentTime >= endSec) {
      el.currentTime = seekSec;
    }
    void el.play().catch(() => setPlaying(false));
  };

  const remaining = Math.max(0, total - elapsed);
  const Icon = playing ? Pause : Play;

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-muted px-4 py-3.5">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? "Pause recording" : "Play recording"}
        aria-pressed={playing}
        className={cn(
          "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground text-foreground transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-foreground hover:text-background"
        )}
      >
        <Icon className="h-4 w-4 fill-current" aria-hidden />
      </button>

      <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: total > 0 ? `${Math.min(100, (elapsed / total) * 100)}%` : "0%" }}
        />
      </span>

      <span className="shrink-0 tabular-nums text-[15px] text-muted-foreground">
        {errored ? "unavailable" : `0:${String(Math.floor(remaining)).padStart(2, "0")}`}
      </span>

      {clip.audioUrl ? (
        <audio
          ref={audioRef}
          src={clip.audioUrl}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={() => {
            const el = audioRef.current;
            if (!el) return;
            if (!(typeof clip.durationMs === "number" && clip.durationMs > 0)) {
              setMediaDuration(Number.isFinite(el.duration) ? el.duration : 0);
            }
            if (seekSec > 0) el.currentTime = seekSec;
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (!el) return;
            if (total > 0 && el.currentTime >= endSec) {
              el.pause();
              el.currentTime = seekSec;
              setPlaying(false);
              setElapsed(0);
              return;
            }
            setElapsed(Math.max(0, el.currentTime - seekSec));
          }}
          onEnded={() => {
            setPlaying(false);
            setElapsed(0);
          }}
          onError={() => {
            setErrored(true);
            setPlaying(false);
          }}
        />
      ) : null}
    </div>
  );
}
