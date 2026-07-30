"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Video } from "lucide-react";
import SnippetReadoutBlock from "./SnippetReadoutBlock";
import { VoiceMark } from "./LoadingState";
import { SlideRender } from "./pdfSlides";
import {
  saveCoachSnippet,
  uploadBreakthroughVideo,
  type CoachReviewSnippet,
  type CoachSnippetState,
  type DirectionLabel,
} from "@/services/api/coachReview";
import { useCoachVideoCapture } from "./useCoachVideoCapture";
import CoachVideoRecorder from "./CoachVideoRecorder";
import {
  CoachCard,
  CoachChip,
  CoachErrorLine,
  CoachEyebrow,
  CoachMetaPill,
} from "./coachChrome";

/* -------------------------------------------------------------------------- */
/*  CoachSnippetReviewCard — one snippet's full coach view (§F.3 + §F.4)       */
/*                                                                            */
/*  Top half mirrors the user's ReadoutCard anatomy (What + Topic stickiness   */
/*  — same component primitives, same labels) so the coach reads the snippet   */
/*  in the same shape the user reads it. Bottom half is the coach control     */
/*  surface — the §S.4 anatomy's "Why + video" slot is replaced with:          */
/*    Direction (private, training)                                            */
/*    Coach note (user-facing)                                                  */
/*    Tag (user-facing)                                                         */
/*    Surface toggle (whether the user sees this snippet)                       */
/*                                                                            */
/*  SAVE TIMING — batched, NOT per click (R4-8). The §F.4 immediate save this  */
/*  header used to describe is RETIRED and was left here stale: note /         */
/*  direction / tag / surfaced live in LOCAL state only, mirror to the overlay */
/*  through onStateChange (which also feeds a localStorage crash cache), and   */
/*  persist in ONE shot from the overlay's Save. The breakthrough-video ref is */
/*  the single exception — a server-side asset, saved live.                    */
/*                                                                            */
/*  The batching is an audience rule, not a preference: note / tag / surfaced  */
/*  are USER-FACING, so a half-written note must not be able to reach the      */
/*  student before the coach commits. The star-verdict lane saves immediately   */
/*  for the mirror-image reason — a verdict is never user-facing, so it has    */
/*  nothing to gate. Do NOT "unify" the two save models: the difference IS the */
/*  audience rule (checked 2026-07-30, when the plumbing was unified and this  */
/*  deliberately was not).                                                     */
/*                                                                            */
/*  Label hygiene (§S.3): no best/worst pre-fill, no AI direction guess in     */
/*  the UI. The coach labels blind, in the chronological order BE returns.    */
/* -------------------------------------------------------------------------- */

const DIRECTIONS: { value: DirectionLabel; label: string }[] = [
  { value: "challenge", label: "Challenge" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "threat", label: "Threat" },
];

export default function CoachSnippetReviewCard({
  sessionId,
  snippet,
  index,
  total,
  initialState = null,
  onStateChange,
  presentationRef,
}: {
  sessionId: string;
  snippet: CoachReviewSnippet;
  index: number;
  total: number;
  /** The session's served deck PDF (for the per-snippet slide page); null = none. */
  presentationRef: string | null;
  /** R4-8 — restore an in-progress (unpublished) edit from the overlay's crash
   *  cache; wins over snippet.coachState when present. */
  initialState?: CoachSnippetState | null;
  /** Fires on EVERY local edit (R4-8: edits live locally until Publish) so the
   *  parent overlay tracks the publish payload + floor without a refetch. */
  onStateChange?: (snippetId: string, next: CoachSnippetState) => void;
}) {
  // R4-8 — save-on-publish: note/direction/tag/surfaced edits live in LOCAL
  // state only (mirrored to the overlay via onStateChange, which also feeds a
  // localStorage crash cache). Nothing hits the server per keystroke; the
  // overlay's Publish persists everything in one shot. The breakthrough-video
  // ref is the one exception (a server-side asset), saved live as before.
  const [coachState, setCoachState] = useState<CoachSnippetState>(
    initialState ?? snippet.coachState
  );
  // FE-5 — the freshest local state for async completions (a video upload
  // finishing must merge against what the coach has edited SINCE the click,
  // not the click-time closure — that stale replace was the "direction chip
  // un-marks after upload" bug).
  const coachStateRef = useRef(coachState);
  coachStateRef.current = coachState;
  const [savingField, setSavingField] = useState<"breakthrough" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // #191 — no pre-fill: the coach writes the note from scratch (that IS the
  // training signal). The BE now sends note="" and no ai_draft_coach_note.
  const [noteDraft, setNoteDraft] = useState(
    (initialState ?? snippet.coachState).note || ""
  );
  // R4-8 — auto-grow the note toward full screen as the coach types (same
  // pattern as BestPresentationOverlay's MarkerEditor): re-fit on every edit,
  // capped at ~70% of the viewport, scrolling past the cap.
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = Math.round(window.innerHeight * 0.7);
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [noteDraft]);

  // The local merge: apply the patch, tell the overlay. This is the ONLY write
  // path for note/direction/tag/surfaced (server persistence happens at
  // Publish via the full snippets[] payload). Reads through coachStateRef, not
  // the render closure, so a call AFTER an await (the video upload/remove
  // paths) merges against the coach's latest edits instead of click-time state.
  const applyLocal = useCallback(
    (patch: Partial<CoachSnippetState>) => {
      const next = { ...coachStateRef.current, ...patch };
      coachStateRef.current = next;
      setCoachState(next);
      onStateChange?.(snippet.id, next);
    },
    [snippet.id, onStateChange]
  );

  // Post-upload save of the breakthrough ref. Returns a boolean so the capture
  // hook keeps the idempotency key if THIS save fails (retry re-runs under the
  // same key → deduped re-upload, no phantom take). Surfaces its own error via
  // the hook (videoCap.error + Retry), so it doesn't set the shared saveError.
  //
  // FE-5 — adopt ONLY the just-persisted video ref from the echo (same policy
  // as removeVideo). note/direction/tag/surfaced live LOCALLY until the
  // take-level Save, so local is always at least as fresh as the echo for
  // those fields — writing any of them back would either revert a mid-upload
  // edit (the "direction chip un-marks" bug) or resurrect a deliberately
  // cleared value from the last save.
  const saveBreakthroughRef = useCallback(
    async (url: string): Promise<boolean> => {
      const echo = await saveCoachSnippet(sessionId, snippet.id, {
        breakthroughVideoRef: url,
      });
      if (!echo) return false;
      applyLocal({ breakthroughVideoRef: echo.breakthroughVideoRef });
      return true;
    },
    [sessionId, snippet.id, applyLocal]
  );

  // Subsystem V: the breakthrough video upload owns its idempotency key +
  // provenance via the shared hook (retry dedupes, re-record is a new take).
  const videoCap = useCoachVideoCapture(
    (file, meta) => uploadBreakthroughVideo(sessionId, snippet.id, file, meta),
    saveBreakthroughRef
  );

  function pickDirection(value: DirectionLabel) {
    applyLocal({ directionLabel: value });
  }

  function toggleSurfaced() {
    applyLocal({ surfaced: !coachState.surfaced });
  }

  // The video REF is a server-side asset pointer, so clearing it stays a live
  // server write (mirrors the upload path), then syncs the local state.
  async function removeVideo() {
    setSavingField("breakthrough");
    setSaveError(null);
    const next = await saveCoachSnippet(sessionId, snippet.id, {
      breakthroughVideoRef: null,
    });
    setSavingField(null);
    if (!next) {
      setSaveError("Couldn't remove the video. Try again.");
      return;
    }
    applyLocal({ breakthroughVideoRef: next.breakthroughVideoRef });
  }

  function onNoteChange(value: string) {
    setNoteDraft(value);
    applyLocal({ note: value });
  }

  // #191 — no auto-seed. Every snippet defaults HIDDEN (surfaced=false): the
  // coach opts in only the key moments they mark, and there's no AI draft note
  // to pre-fill. Nothing reaches the student until the coach surfaces + publishes.

  // Status badge — three states (per §F.3):
  //   "Skipped"        — nothing set
  //   "Training only"  — direction set, not surfaced (private-lane only)
  //   "Sent to user"   — surfaced (user-lane active)
  const statusLabel = coachState.surfaced
    ? "Sent to user"
    : coachState.directionLabel
    ? "Training only"
    : "Skipped";
  const statusTone = coachState.surfaced
    ? "text-success"
    : coachState.directionLabel
    ? "text-primary"
    : "text-muted-foreground";

  return (
    <CoachCard gap="lg">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground">
          Snippet {index + 1} of {total}
        </span>
        {/* #191 — spoken take vs a re-read of a corrected piece. */}
        {snippet.recordingKind ? (
          <CoachMetaPill
            tone={snippet.recordingKind === "read" ? "accent" : "muted"}
          >
            {snippet.recordingKind === "read" ? "Read" : "Spoken"}
          </CoachMetaPill>
        ) : null}
      </div>

      {/* The slide on screen when this snippet started (deck attached) — the
          coach's reference for what the user was talking about, same slide the
          user sees. Above the words; coach controls stay below. */}
      {snippet.slide ? (
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={snippet.slide.index}
          title={snippet.slide.title}
          body={snippet.slide.body}
          className="w-full"
        />
      ) : null}

      <SnippetReadoutBlock
        audioRef={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
        transcript={snippet.transcript}
        acousticRead={snippet.acousticRead}
        features={snippet.features}
      />

      {/* Coach controls — the §F.3 split-sink surface */}
      <div className="border-t border-border pt-4">
        {/* Direction (private — training lane only, NEVER user-visible per AC-9) */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            Direction
            <CoachEyebrow className="ml-2">Private · training</CoachEyebrow>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => (
              <CoachChip
                key={d.value}
                active={coachState.directionLabel === d.value}
                onClick={() => pickDirection(d.value)}
              >
                {d.label}
              </CoachChip>
            ))}
          </div>
        </div>

        {/* Moment video — appears once the snippet is labeled challenge OR
            threat (FP-3), so the coach can attach a short clip about the
            moment either way. The BE stores both; BE-6 surfaces the threat
            ones on the student feedback page. */}
        {coachState.directionLabel === "challenge" ||
        coachState.directionLabel === "threat" ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">
              Video
              <CoachEyebrow className="ml-2">Shown to user</CoachEyebrow>
            </p>
            {coachState.breakthroughVideoRef ? (
              <div className="mt-2 flex flex-col gap-2">
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={coachState.breakthroughVideoRef}
                    controls
                    playsInline
                    className="w-full bg-black"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void removeVideo()}
                  disabled={savingField === "breakthrough"}
                  className="self-start text-[13px] text-destructive hover:underline disabled:opacity-50"
                >
                  Remove video
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center">
                  {videoCap.uploading ? (
                    <VoiceMark size={20} />
                  ) : (
                    <Video className="h-5 w-5 text-primary" aria-hidden />
                  )}
                  <span className="text-[13px] font-medium text-primary">
                    {videoCap.uploading ? "Uploading…" : "Add a video"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    A short video about this moment
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={videoCap.uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      // New selection → new record action / key.
                      if (f) videoCap.submit(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {/* In-app camera capture (FP-2), beside the file drop-zone.
                    Outside the <label> so its buttons don't trip the picker. */}
                <CoachVideoRecorder
                  onRecorded={(file) =>
                    videoCap.submit(file, { source: "in-app-recording" })
                  }
                  disabled={videoCap.uploading}
                />
              </div>
            )}
            {videoCap.error ? (
              <p className="mt-1 flex items-center gap-2 text-[12px] text-destructive">
                <span>{videoCap.error}</span>
                {videoCap.retryable ? (
                  <button
                    type="button"
                    onClick={videoCap.retry}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Retry
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Coach note — user-facing prose */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-foreground">
            Coach note
            <CoachEyebrow className="ml-2">Shown to user</CoachEyebrow>
          </p>
          {/* #190 — a big, comfortable editor (founder ask): tall min height,
              full width, auto-grows with content up to 70vh. */}
          <textarea
            ref={noteRef}
            value={noteDraft}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={6}
            placeholder="What to take away from this snippet…"
            className="mt-2 min-h-[10rem] max-h-[70vh] w-full resize-y overflow-y-auto rounded-xl border border-border bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-primary"
          />
        </div>

        {/* Surface toggle — does the user see this snippet at all? */}
        <button
          type="button"
          onClick={toggleSurfaced}
          className={`mt-4 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
            coachState.surfaced
              ? "border-success/50 bg-success/5"
              : "border-border bg-background hover:border-primary/40"
          } disabled:opacity-50`}
        >
          <span className="flex items-center gap-2 text-[14px] text-foreground">
            {coachState.surfaced ? (
              <Eye className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <EyeOff
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            )}
            Send this snippet to the user
          </span>
          <span className="text-[12px] text-muted-foreground">
            {coachState.surfaced ? "Yes" : "No"}
          </span>
        </button>

        {/* Status footer — visible distinction between the three card states */}
        <div className="mt-3 flex items-center gap-1.5">
          {coachState.surfaced ? (
            <CheckCircle2
              className="h-3.5 w-3.5 text-success"
              aria-hidden
            />
          ) : (
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                coachState.directionLabel
                  ? "bg-primary"
                  : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
          )}
          <span className={`text-[12px] ${statusTone}`}>{statusLabel}</span>
          {saveError ? (
            <CoachErrorLine inline className="ml-2">
              · {saveError}
            </CoachErrorLine>
          ) : null}
        </div>
      </div>
    </CoachCard>
  );
}
