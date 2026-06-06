"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  saveCoachSnippet,
  type CoachReviewSnippet,
  type CoachSnippetState,
  type DirectionLabel,
  type CoachTag,
} from "@/services/api/coachReview";

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

const NOTE_DEBOUNCE_MS = 500;

export default function CoachSnippetReviewCard({
  sessionId,
  snippet,
  index,
  total,
  onStateChange,
}: {
  sessionId: string;
  snippet: CoachReviewSnippet;
  index: number;
  total: number;
  /** Fires after every successful save so the parent overlay can update
   *  its publish-floor calculation (§3.10) without a session refetch. */
  onStateChange?: (snippetId: string, next: CoachSnippetState) => void;
}) {
  // Local state mirrors the persisted coach_state. We initialize from the
  // payload (so re-mounting resumes where the coach left off) and reconcile
  // on every successful save's echo (so the persisted truth always wins).
  const [coachState, setCoachState] = useState<CoachSnippetState>(
    snippet.coachState
  );
  const [savingField, setSavingField] = useState<
    "direction" | "note" | "tag" | "surfaced" | null
  >(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounced note save. We don't want to fire on every keystroke — that
  // would saturate the BE on a long note. 500 ms after the last edit, we
  // ship whatever's in `noteDraft`.
  const [noteDraft, setNoteDraft] = useState(snippet.coachState.note);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (
      field: "direction" | "note" | "tag" | "surfaced",
      patch: Parameters<typeof saveCoachSnippet>[2]
    ) => {
      setSavingField(field);
      setSaveError(null);
      const next = await saveCoachSnippet(sessionId, snippet.id, patch);
      setSavingField(null);
      if (!next) {
        setSaveError("Couldn't save. Try again.");
        return;
      }
      setCoachState(next);
      onStateChange?.(snippet.id, next);
    },
    [sessionId, snippet.id, onStateChange]
  );

  function pickDirection(value: DirectionLabel) {
    void persist("direction", { directionLabel: value });
  }

  function pickTag(value: CoachTag) {
    // Toggle: same tag tapped twice clears it.
    const next = coachState.tag === value ? null : value;
    void persist("tag", { tag: next });
  }

  function toggleSurfaced() {
    void persist("surfaced", { surfaced: !coachState.surfaced });
  }

  function onNoteChange(value: string) {
    setNoteDraft(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      void persist("note", { note: value });
    }, NOTE_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      // Flush any pending note save when the card unmounts (e.g. overlay
      // closes mid-typing). Drop on the floor if the timer hasn't fired —
      // the immediate-persist guarantee is on the keystroke loop, and a
      // closing card is a fine moment to give up the pending edit.
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
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

      {/* What — mirrors ReadoutCard / AuditInsights anatomy 1:1 */}
      <div>
        <p className="text-sm font-semibold text-foreground">What</p>
        <div className="mt-2">
          <MediaPlayer
            src={snippet.audioRef}
            startOffsetMs={snippet.startOffsetMs}
            durationMs={snippet.durationMs}
          />
        </div>
        {snippet.transcript ? (
          <blockquote className="mt-3 border-l-2 border-primary pl-3 text-[17px] font-medium italic leading-relaxed text-foreground">
            {snippet.transcript}
          </blockquote>
        ) : null}
      </div>

      {/* Topic stickiness — the one neutral metric, unchanged from ReadoutCard */}
      {(snippet.stickiness.comment || snippet.stickiness.composite != null) && (
        <div>
          <p className="text-sm font-semibold text-foreground">
            Topic stickiness
          </p>
          {snippet.stickiness.comment ? (
            <p className="mt-1.5 text-[14px] italic leading-relaxed text-foreground">
              {snippet.stickiness.comment}
            </p>
          ) : null}
          {snippet.stickiness.composite != null ? (
            <p className="mt-1 text-[14px] text-muted-foreground">
              composite {snippet.stickiness.composite.toFixed(2)}
            </p>
          ) : null}
        </div>
      )}

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
                  disabled={savingField === "direction"}
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

        {/* Coach note — user-facing prose */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-foreground">
            Coach note
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Shown to user
            </span>
          </p>
          <textarea
            value={noteDraft}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            placeholder="What to take away from this snippet…"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
          />
          {savingField === "note" ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Saving…</p>
          ) : null}
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
                  disabled={savingField === "tag"}
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
          disabled={savingField === "surfaced"}
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
