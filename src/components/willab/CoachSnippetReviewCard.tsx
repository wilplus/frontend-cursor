"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import SnippetReadoutBlock from "./SnippetReadoutBlock";
import { SlideRender } from "./pdfSlides";
import SnippetSlideCorrection from "./SnippetSlideCorrection";
import type { ReadoutSlide } from "./readout";
import {
  saveCoachSnippet,
  type CoachReviewSnippet,
  type CoachSnippetState,
} from "@/services/api/coachReview";
import {
  buildRatingBody,
  saveStateRating,
  CONFIDENCE_QUESTION,
  type TernaryValue,
} from "@/services/api/stateRatings";
import ConfidenceLabelChips from "./ConfidenceLabelChips";
import CoachConfidencePracticeReview from "./CoachConfidencePracticeReview";
import {
  CoachCard,
  CoachEyebrow,
  CoachMetaPill,
} from "./coachChrome";

/* -------------------------------------------------------------------------- */
/*  CoachSnippetReviewCard — one snippet's full coach view (§F.3 + §F.4)       */
/*                                                                            */
/*  Top half mirrors the user's ReadoutCard anatomy (What + Topic stickiness   */
/*  — same component primitives, same labels) so the coach reads the snippet   */
/*  in the same shape the user reads it. Bottom half is the coach control     */
/*  surface — the §S.4 explanation slot is replaced with:                     */
/*    Blind confidence label (separate research provenance)                    */
/*    Coach note (user-facing)                                                  */
/*    Tag (user-facing)                                                         */
/*    Surface toggle (whether the user sees this snippet)                       */
/*                                                                            */
/*  SAVE TIMING — batched, NOT per click (R4-8). The §F.4 immediate save this  */
/*  header used to describe is RETIRED and was left here stale: note / tag /   */
/*  surfaced live in LOCAL state only, mirror to the overlay                    */
/*  through onStateChange (which also feeds a localStorage crash cache), and   */
/*  persist in ONE shot from the overlay's Save.                               */
/*                                                                            */
/*  The batching is an audience rule, not a preference: note / tag / surfaced  */
/*  are USER-FACING, so a half-written note must not be able to reach the      */
/*  student before the coach commits. The star-verdict lane saves immediately   */
/*  for the mirror-image reason — a verdict is never user-facing, so it has    */
/*  nothing to gate. Do NOT "unify" the two save models: the difference IS the */
/*  audience rule (checked 2026-07-30, when the plumbing was unified and this  */
/*  deliberately was not).                                                     */
/*                                                                            */
/*  Label hygiene (§S.3): no best/worst pre-fill, no machine guess in the UI.  */
/*  The coach labels blind, in the chronological order BE returns.            */
/*                                                                            */
/*  Blind labels never render a machine read. The backend stamps               */
/*  `saw_model_output: false`, so exposing one here would corrupt provenance.  */
/* -------------------------------------------------------------------------- */

/* The fixed answer space now lives in ConfidenceLabelChips (the shared
 * instrument, extracted from this card 2026-08-10) — see RATING_OPTIONS
 * there for the Ambiguous-vs-unrateable rationale. */

export default function CoachSnippetReviewCard({
  sessionId,
  snippet,
  index,
  total,
  initialState = null,
  onStateChange,
  presentationRef,
  slides = [],
}: {
  sessionId: string;
  snippet: CoachReviewSnippet;
  index: number;
  total: number;
  /** The whole deck, for the slide-correction control. Empty (the default)
   *  hides it — there is nothing to correct a mapping to. */
  slides?: readonly ReadoutSlide[];
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
  // overlay's Publish persists everything in one shot.
  const [coachState, setCoachState] = useState<CoachSnippetState>(
    initialState ?? snippet.coachState
  );
  // FE-5 — the freshest local state for async completions (a video upload
  // finishing must merge against what the coach has edited SINCE the click,
  // not the click-time closure — that stale replace was the "direction chip
  // un-marks after upload" bug).
  const coachStateRef = useRef(coachState);
  coachStateRef.current = coachState;

  // The BLIND RATING lane. Deliberately NOT part of CoachSnippetState:
  //   * it persists to its own endpoint (the state-generic ternary), and
  //   * it saves IMMEDIATELY, not at the overlay's Save.
  // That timing follows this file's own audience rule: note/tag/surfaced batch
  // because they are USER-FACING and a half-written note must not reach the
  // student early. A rating is never user-facing, so it has nothing to gate —
  // the same reason the star-verdict lane saves live.
  // Seeded from the coach's OWN persisted answer (the BE scopes that read to
  // the authenticated rater — never the panel's, which would anchor). Before
  // this existed a rated snippet reopened as unanswered, so the coach either
  // re-rated from scratch — a second, non-independent look at one clip — or
  // skipped it as already done and left it unrated.
  const seeded = initialState ?? snippet.coachState;
  const [rating, setRating] = useState<TernaryValue | null>(seeded.ratingValue);
  const [unrateable, setUnrateable] = useState(seeded.ratingUnrateable);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

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

  // One writer for both controls so the XOR can never be violated from the UI:
  // picking a value clears `unrateable`, and abstaining clears the value. The
  // backend rejects a body carrying both; constructing one here would be a bug
  // that only shows up as a 400 the coach cannot act on.
  const submitRating = useCallback(
    async (nextValue: TernaryValue | null, nextUnrateable: boolean) => {
      const body = buildRatingBody(nextValue, nextUnrateable);
      if (!body) return;
      setRating(nextValue);
      setUnrateable(nextUnrateable);
      setRatingSaving(true);
      setRatingError(null);
      const result = await saveStateRating(snippet.id, body);
      setRatingSaving(false);
      if (!result.ok) {
        setRatingError(result.error ?? "Couldn't save that. Try again.");
      }
    },
    [snippet.id]
  );

  function pickRating(value: TernaryValue) {
    void submitRating(value, false);
  }

  function toggleUnrateable() {
    // Re-tapping an active abstention returns to "unanswered" locally; it does
    // not send anything, because there is no body that means "never mind".
    if (unrateable) {
      setUnrateable(false);
      return;
    }
    void submitRating(null, true);
  }

  function toggleSurfaced() {
    applyLocal({ surfaced: !coachState.surfaced });
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
  //   "Training only"  — rated, not surfaced (private-lane only)
  //   "Sent to user"   — surfaced (user-lane active)
  const rated = rating !== null || unrateable;
  const statusLabel = coachState.surfaced
    ? "Sent to user"
    : rated
    ? "Training only"
    : "Skipped";
  const statusTone = coachState.surfaced
    ? "text-success"
    : rated
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

      {/* …and the one place a human can say the mapping above is WRONG
          (founder 2026-08-11). The coach is already looking at the slide and
          the words together, which is the only moment in the product where
          that judgment is cheap and reliable — so the label is collected
          here rather than on a screen built for it. */}
      <SnippetSlideCorrection
        snippetId={snippet.id}
        slides={slides}
        mappedIndex={snippet.slide ? snippet.slide.index : null}
      />

      {/* Audio + transcript ONLY. Machine-derived features are deliberately
          NOT passed: the backend stamps
          saw_model_output=false on every rating written below, so showing
          them here would make that stamp a lie. Judging the machine's output
          is the adjudication lane's job, on its own screen. */}
      <SnippetReadoutBlock
        audioRef={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
        transcript={snippet.transcript}
      />

      {/* Coach controls — the §F.3 split-sink surface */}
      <div className="border-t border-border pt-4">
        {/* The blind rating (private — training lane only, NEVER user-visible
            per AC-9). The QUESTION is on screen because the answer space is
            fixed and state-generic: without it, "Yes" is unanchored. */}
        {/* THE shared instrument (founder 2026-08-10) — this card was the
            donor; it now renders the same component every other lane does,
            so the surfaces cannot drift. */}
        <ConfidenceLabelChips
          question={CONFIDENCE_QUESTION}
          eyebrow={
            <CoachEyebrow className="ml-2">Private · training</CoachEyebrow>
          }
          value={rating}
          unrateable={unrateable}
          saving={ratingSaving}
          error={ratingError}
          onPick={pickRating}
          onToggleUnrateable={toggleUnrateable}
        />

        <CoachConfidencePracticeReview
          sessionId={sessionId}
          snippetId={snippet.id}
          enabled={!ratingSaving && !unrateable && (rating === "yes" || rating === "no")}
        />

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
                rated ? "bg-primary" : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
          )}
          <span className={`text-[12px] ${statusTone}`}>{statusLabel}</span>
        </div>
      </div>
    </CoachCard>
  );
}
