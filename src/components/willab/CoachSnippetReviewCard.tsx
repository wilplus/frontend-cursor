"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Video } from "lucide-react";
import SnippetReadoutBlock from "./SnippetReadoutBlock";
import { SlideRender } from "./pdfSlides";
import {
  saveCoachSnippet,
  uploadBreakthroughVideo,
  type CoachReviewSnippet,
  type CoachSnippetState,
  type DirectionLabel,
  type CoachTag,
} from "@/services/api/coachReview";
import { useCoachVideoCapture } from "./useCoachVideoCapture";

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
/*  Per-snippet immediate save (§F.4):                                         */
/*    - Direction / tag / surfaced toggles save on click.                      */
/*    - Note is debounced 500 ms after the last keystroke.                     */
/*    - Every save round-trips to BE and echoes back the persisted state;      */
/*      we trust the echo (no optimistic-on-error path — if save fails the     */
/*      local state stays as-is and we surface the failure quietly).           */
/*                                                                            */
/*  Label hygiene (§S.3): no best/worst pre-fill, no AI direction guess in     */
/*  the UI. The coach labels blind, in the chronological order BE returns.    */
/* -------------------------------------------------------------------------- */

const DIRECTIONS: { value: DirectionLabel; label: string }[] = [
  { value: "challenge", label: "Challenge" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "threat", label: "Threat" },
];

const TAGS: { value: CoachTag; label: string }[] = [
  { value: "strong", label: "Strong" },
  { value: "to_work_on", label: "To work on" },
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
  const [savingField, setSavingField] = useState<"breakthrough" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState(
    (initialState ?? snippet.coachState).note || snippet.aiDraftNote || ""
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
  const didAutoSeedRef = useRef(false);

  // The local merge: apply the patch, tell the overlay. This is the ONLY write
  // path for note/direction/tag/surfaced (server persistence happens at
  // Publish via the full snippets[] payload).
  const applyLocal = useCallback(
    (patch: Partial<CoachSnippetState>) => {
      const next = { ...coachState, ...patch };
      setCoachState(next);
      onStateChange?.(snippet.id, next);
    },
    [coachState, snippet.id, onStateChange]
  );

  // Post-upload save of the breakthrough ref. Returns a boolean so the capture
  // hook keeps the idempotency key if THIS save fails (retry re-runs under the
  // same key → deduped re-upload, no phantom take). Surfaces its own error via
  // the hook (videoCap.error + Retry), so it doesn't set the shared saveError.
  const saveBreakthroughRef = useCallback(
    async (url: string): Promise<boolean> => {
      const next = await saveCoachSnippet(sessionId, snippet.id, {
        breakthroughVideoRef: url,
      });
      if (!next) return false;
      setCoachState(next);
      onStateChange?.(snippet.id, next);
      return true;
    },
    [sessionId, snippet.id, onStateChange]
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

  function pickTag(value: CoachTag) {
    // Toggle: same tag tapped twice clears it.
    applyLocal({ tag: coachState.tag === value ? null : value });
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

  // On mount: seed default-surfaced + the AI draft note LOCALLY (no server
  // write — R4-8) so the overlay's publish payload / floor sees the defaults.
  // The BE also defaults snippets to surfaced=true, so this is presentation
  // state, not a persistence requirement.
  useEffect(() => {
    if (didAutoSeedRef.current || initialState) return;
    const needsNote = !!snippet.aiDraftNote && !snippet.coachState.note;
    const needsSurfaced = !snippet.coachState.surfaced;
    if (!needsNote && !needsSurfaced) return;
    didAutoSeedRef.current = true;
    const patch: Partial<CoachSnippetState> = {};
    if (needsNote) patch.note = snippet.aiDraftNote!;
    if (needsSurfaced) patch.surfaced = true;
    applyLocal(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <span className="text-[12px] text-muted-foreground">
        Snippet {index + 1} of {total}
      </span>

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
        stickiness={snippet.stickiness}
        features={snippet.features}
        acousticRead={snippet.acousticRead}
        autoComment={snippet.autoComment}
      />

      {/* Coach controls — the §F.3 split-sink surface */}
      <div className="border-t border-border pt-4">
        {/* Direction (private — training lane only, NEVER user-visible per AC-9) */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            Direction
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Private · training
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => {
              const active = coachState.directionLabel === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => pickDirection(d.value)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  } disabled:opacity-50`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Breakthrough video — appears once the snippet is labeled "challenge"
            so the coach can attach a short clip justifying the breakthrough.
            (Upload endpoint is Phase 2 BE; until it ships this soft-fails.) */}
        {coachState.directionLabel === "challenge" ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">
              Breakthrough video
              <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                Shown to user
              </span>
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
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center">
                <Video className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-[13px] font-medium text-primary">
                  {videoCap.uploading ? "Uploading…" : "Add a breakthrough video"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Short clip explaining why this was the breakthrough
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
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Shown to user
            </span>
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

        {/* Tag — user-facing strong/to-work-on (§S.5; independent of direction) */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-foreground">
            Tag
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Shown to user
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TAGS.map((t) => {
              const active = coachState.tag === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => pickTag(t.value)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  } disabled:opacity-50`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
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
            <span className="ml-2 text-[12px] text-destructive">
              · {saveError}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
