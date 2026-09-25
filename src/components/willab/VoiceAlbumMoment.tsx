"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import SnippetWavePlayer from "./SnippetWavePlayer";
import LoadingState from "./LoadingState";
import {
  fetchMomentHistory,
  saveMomentNote,
  type MomentEvent,
  type MomentHistory,
  type VoiceAlbumEntry,
} from "@/services/api/voiceAlbum";

/* -------------------------------------------------------------------------- */
/*  One Voice Album moment: the playback, and the whole history behind it.     */
/*                                                                            */
/*  Founder 2026-09-18: "the notes from the coach, the exercises, the whole    */
/*  history behind this confident moment ... I want the whole history so I can */
/*  see from where it came from and the short note at the end."                */
/*                                                                            */
/*  The history is loaded on OPEN, not with the feed: a project's moments each */
/*  carry an exercise, its attempts and a thread, and pre-loading all of that  */
/*  for a list the user scrolls past would pay for every moment to read one.   */
/*                                                                            */
/*  The collapsed row says so out loud. An earlier build hid the history       */
/*  behind a bare tap on the card and the founder could not find it — so the   */
/*  second line is a labelled control with a chevron, not an invisible target. */
/* -------------------------------------------------------------------------- */

/** The owner's five states, in the words they were asked in. */
const OWNER_ANSWER: Record<string, string> = {
  yes: "Yes — Confident",
  in_between: "In-between",
  no: "No — Not confident",
  not_sure: "Not sure",
  audio_unclear: "Audio unclear",
};

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function countComments(events: MomentEvent[]): number {
  return events.filter((event) => event.kind === "note").length;
}

export default function VoiceAlbumMoment({
  projectId,
  entry,
  open,
  onToggle,
}: {
  projectId: string;
  entry: VoiceAlbumEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const [history, setHistory] = useState<MomentHistory | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [extraNotes, setExtraNotes] = useState<MomentEvent[]>([]);

  useEffect(() => {
    if (!open || status !== "idle") return;
    let active = true;
    setStatus("loading");
    void fetchMomentHistory(projectId, entry.momentKey).then((result) => {
      if (!active) return;
      setHistory(result);
      setStatus(result ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [open, status, projectId, entry.momentKey]);

  const events = [...(history?.events ?? []), ...extraNotes];
  const recorded = shortDate(entry.enteredAt);
  const takeIndex = history?.origin.takeIndex ?? entry.takeIndex;

  const onNoteSaved = useCallback((note: MomentEvent) => {
    setExtraNotes((current) => [...current, note]);
  }, []);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        open ? "border-foreground" : "border-border"
      )}
    >
      <div className="p-3">
        <SnippetWavePlayer
          seed={entry.momentKey}
          src={entry.audioUrl}
          startOffsetMs={entry.startOffsetMs}
          durationMs={entry.durationMs}
          label={recorded ? `the moment from ${recorded}` : "this moment"}
        />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 pb-3 pl-[66px] pr-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {recorded ? <span>{recorded}</span> : null}
        {recorded && takeIndex != null ? <Dot /> : null}
        {takeIndex != null ? <span>Take {takeIndex}</span> : null}
        {status === "ready" && countComments(events) > 0 ? (
          <>
            <Dot />
            <span>
              {countComments(events)}
              {countComments(events) === 1 ? " note" : " notes"}
            </span>
          </>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground">
          {open ? "Hide" : "History"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="border-t border-border px-3.5 pb-3.5 pt-3.5">
          {status === "loading" ? (
            <LoadingState placement="surface" />
          ) : status === "error" ? (
            <p className="py-2 text-[14px] text-muted-foreground">
              We couldn&apos;t load this history just now.
            </p>
          ) : (
            <>
              <Origin
                takeIndex={takeIndex}
                slideIndex={history?.origin.slideIndex ?? entry.slideIndex}
                recorded={recorded}
              />
              <ul className="m-0 list-none p-0">
                {events.map((event, index) => (
                  <Event key={`${event.kind}-${index}`} event={event} />
                ))}
              </ul>
              <NoteComposer
                projectId={projectId}
                momentKey={entry.momentKey}
                onSaved={onNoteSaved}
              />
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function Dot() {
  return <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-current opacity-50" aria-hidden />;
}

export function Origin({
  takeIndex,
  slideIndex,
  recorded,
}: {
  takeIndex: number | null;
  slideIndex: number | null;
  recorded: string | null;
}) {
  const parts: string[] = [];
  if (takeIndex != null) parts.push(`Take ${takeIndex}`);
  if (slideIndex != null) parts.push(`Slide ${slideIndex}`);
  if (recorded) parts.push(recorded);
  if (parts.length === 0) return null;
  return (
    <p className="m-0 mb-1 flex flex-wrap items-center gap-[7px] text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-[7px]">
          {index > 0 ? <Dot /> : null}
          {part}
        </span>
      ))}
    </p>
  );
}

/* The rail: one vertical line, one dot per event, so the column reads as a
   history rather than as a stack of unrelated cards. */
export function Event({ event }: { event: MomentEvent }) {
  const when = shortDate(event.at);
  return (
    <li className="relative py-3 pl-[26px] before:absolute before:bottom-0 before:left-1 before:top-0 before:w-px before:bg-border last:before:h-[18px] first:before:top-[18px]">
      <span
        className={cn(
          "absolute left-0 top-4 h-[9px] w-[9px] rounded-full border-2 border-card",
          event.kind === "exercise" ? "bg-primary" : "bg-border"
        )}
        aria-hidden
      />
      {event.kind === "owner_answer" ? (
        <>
          <Head who="You" when={when} />
          <p className="m-0 text-[14px] leading-snug">
            <span className="text-muted-foreground">answered</span>{" "}
            {OWNER_ANSWER[event.response] ?? event.response}
          </p>
        </>
      ) : event.kind === "coach_agreed" ? (
        <>
          <Head who={event.who} when={when} />
          <p className="m-0 text-[14px] leading-snug text-muted-foreground">
            heard the same thing
          </p>
        </>
      ) : event.kind === "exercise" ? (
        <Exercise event={event} when={when} />
      ) : (
        <>
          <Head who={event.who} when={when} />
          <p className="m-0 mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
            {event.body}
          </p>
        </>
      )}
    </li>
  );
}

function Head({ who, when }: { who: string; when: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-[13px] font-semibold">{who}</span>
      {when ? <span className="text-[11.5px] text-muted-foreground">{when}</span> : null}
    </div>
  );
}

function Exercise({
  event,
  when,
}: {
  event: Extract<MomentEvent, { kind: "exercise" }>;
  when: string | null;
}) {
  const [showVideo, setShowVideo] = useState(false);
  return (
    <>
      <Head who="Exercise added" when={when} />
      <div className="mt-2 rounded-lg border border-border border-l-2 border-l-primary bg-muted/40 px-3 py-2.5">
        <div className="text-[13.5px] font-semibold">{event.title}</div>
        {event.instruction ? (
          <p className="m-0 mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
            {event.instruction}
          </p>
        ) : null}

        {event.videoUrl || event.attempts.length > 0 ? (
          <div className="mt-2.5 flex items-center border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => setShowVideo((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-foreground"
            >
              <Play className="h-3.5 w-3.5" aria-hidden />
              {showVideo ? "Hide exercise" : "Watch again"}
            </button>
          </div>
        ) : null}

        {showVideo ? (
          <div className="mt-2.5 flex flex-col gap-2.5">
            {event.videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- the
              // exercise video is coach-recorded; captions are authored with
              // the exercise, not injected here.
              <video
                src={event.videoUrl}
                controls
                preload="metadata"
                className="w-full rounded-lg bg-foreground/90"
              />
            ) : (
              <p className="m-0 text-[13px] text-muted-foreground">
                This exercise has no video.
              </p>
            )}
            {event.attempts.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {event.attempts.map((attempt) => (
                  <li key={attempt.attemptId} className="flex flex-col gap-1">
                    <SnippetWavePlayer
                      seed={attempt.attemptId}
                      src={attempt.audioUrl}
                      durationMs={attempt.durationMs}
                      size="compact"
                      label={`attempt ${attempt.index ?? ""}`.trim()}
                    />
                    <span className="pl-[42px] text-[12px] text-muted-foreground">
                      Attempt {attempt.index ?? "—"}
                      {attempt.kept ? " · kept" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** One tap opens it, one tap saves it — founder 2026-09-18. */
function NoteComposer({
  projectId,
  momentKey,
  onSaved,
}: {
  projectId: string;
  momentKey: string;
  onSaved: (note: MomentEvent) => void;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const body = value.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    const note = await saveMomentNote(projectId, momentKey, body);
    setSaving(false);
    if (!note) {
      setError("Couldn't save that note. Try again.");
      return;
    }
    onSaved(note);
    setValue("");
    setOpenForm(false);
  }

  if (!openForm) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:border-foreground"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a note
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <label className="sr-only" htmlFor={`note-${momentKey}`}>
        Your note
      </label>
      <textarea
        id={`note-${momentKey}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Your note"
        maxLength={2000}
        className="min-h-[76px] w-full resize-y rounded-[10px] border border-foreground bg-background px-3 py-2.5 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground"
      />
      {error ? <p className="m-0 text-[13px] text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpenForm(false);
            setError(null);
          }}
          className="rounded-full border border-border px-4 py-2.5 text-[13px] font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || value.trim().length === 0}
          className="rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
