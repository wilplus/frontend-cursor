"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Mic, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import {
  isUnappliedPolish,
  segmentIdealText,
  type IdealKeyMomentLink,
  type IdealText,
  type MomentSuggestion,
} from "@/services/api/idealText";
import {
  fetchMomentExplanation,
  unlockMoments,
  type MomentExplanationResult,
} from "@/services/api/momentExplanation";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";

/* -------------------------------------------------------------------------- */
/*  MomentStars — the SD key-moment star layer, shared by BOTH surfaces         */
/*                                                                            */
/*  The post-recording screen (IdealTextReadout) and the notebook              */
/*  (IdealTextOverlay) render the SAME stars, sheet and Approve flow. This     */
/*  module owns all of it so the two can never drift:                          */
/*    • MomentStarText — the text with inline grey/orange stars + applied folds*/
/*    • useMomentStars — sheet state, open/approve/revert/buy, the fold map    */
/*    • MomentSheet    — the full-screen sheet (free playback → suggestion or  */
/*                       the paid coach block behind the unlock)              */
/*  The host keeps its own chrome (editor, notes, badges) and tells the hook   */
/*  when an unlock lands.                                                      */
/* -------------------------------------------------------------------------- */

/** MOMENT_SUGGESTIONS — the local fold a just-Approved suggestion applies over
 *  the served text: emphasize wraps the phrase bold+orange; replace swaps in
 *  the rephrase. Optimistic + reversible until the sheet closes; the BE folds
 *  it into the served text on the next fetch. `text` is a marker string. */
export type LocalFold = { kind: "emphasize" | "replace"; text: string };

/** The emphasis marker for an approved charisma phrase. ONE marker, never
 *  nested: the rich-marker parser is FLAT, so `**{{orange:…}}**` would match
 *  the bold token and print the inner `{{orange:…}}` as raw syntax. The accent
 *  marker alone carries "these words hold particular value" and renders
 *  bold+orange (RichText). Byte-identical to the BE's serve-time fold, so the
 *  optimistic text and the refetched text agree. */
export function emphasizeMarker(anchor: string): string {
  return `{{orange:${anchor}}}`;
}

/** The fold map's key — a stable PER-MOMENT identity (review R-ms1). Never
 *  snippetId alone: SD moments keyed by momentId carry snippetId "" (all of
 *  them would collide on one key), and two moments may share a snippet. Mirrors
 *  the explanation fetch's `momentId ?? snippetId` identity, disambiguated by
 *  the anchor. */
export function momentKey(m: IdealKeyMomentLink): string {
  return m.momentId ?? `${m.snippetId}|${m.anchor}`;
}

/** D-3 — a mount-scoped back-dismiss entry for the moment sheet (hooks can't
 *  be conditional, so the conditional mount of this child does the pushing). */
function SheetBackDismiss({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}

/** MOMENT_SUGGESTIONS — the moment sheet body. Snippet playback is always free
 *  at the top; then either the grey suggestion card (free) or the verified
 *  coach message (paid — locked shows the blurred teaser + unlock). */
function MomentSheetBody({
  moment,
  momentContent,
  applied,
  onApprove,
  onRevert,
  onBuy,
  onReRecord,
}: {
  moment: IdealKeyMomentLink;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  onApprove: () => void;
  onRevert: () => void;
  onBuy: () => Promise<string | null>;
  /** DELIVERY_STARS — re-record this snippet with the feedback applied. Absent
   *  → the delivery card shows the observation without a mic. */
  onReRecord?: (
    snippetId: string,
    takeSessionId: string,
    audio: Blob,
    durationSec: number
  ) => Promise<boolean>;
}) {
  const suggestion =
    moment.star === "suggestion" ? moment.suggestion ?? null : null;
  return (
    <div className="flex flex-col gap-4">
      {/* The moment as you said it — always free. The ref is usually the whole
          take, so clamp to this moment's slice; without a usable duration
          there is nothing to clamp to, and an unclamped player beats a player
          that pauses instantly (MediaPlayer stops at start+duration). */}
      {moment.snippetAudioRef ? (
        moment.durationMs && moment.durationMs > 0 ? (
          <MediaPlayer
            src={moment.snippetAudioRef}
            startOffsetMs={moment.startOffsetMs ?? 0}
            durationMs={moment.durationMs}
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={moment.snippetAudioRef} controls className="w-full" />
        )
      ) : null}
      {suggestion ? (
        suggestion.kind === "structure" ? (
          // STRUCTURAL_STARS — a delivery prompt, not an edit: no Approve, no
          // fold, no unlock. The star persists and always re-opens.
          <StructuralPracticeCard suggestion={suggestion} />
        ) : suggestion.kind === "delivery" ? (
          // DELIVERY_STARS — a measured observation; the action is a re-record
          // of this snippet, not a text edit.
          <DeliveryStarCard
            suggestion={suggestion}
            snippetId={moment.snippetId}
            takeSessionId={moment.takeSessionId}
            onReRecord={onReRecord}
          />
        ) : (
          <MomentSuggestionCard
            suggestion={suggestion}
            applied={applied}
            onApprove={onApprove}
            onRevert={onRevert}
          />
        )
      ) : momentContent === null ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Loading…
        </p>
      ) : momentContent.kind === "locked" ? (
        <MomentUnlockPrompt
          priceCredits={momentContent.priceCredits}
          hasVideo={moment.coach?.hasVideo ?? false}
          onBuy={onBuy}
        />
      ) : momentContent.kind === "error" ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Couldn&apos;t load this moment just now. Try again in a moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {momentContent.videoRef ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={momentContent.videoRef}
              controls
              playsInline
              className="w-full rounded-xl bg-black"
            />
          ) : null}
          {momentContent.note ? (
            <p className="text-[15px] leading-relaxed text-foreground">
              {momentContent.note}
            </p>
          ) : null}
          {!momentContent.videoRef && !momentContent.note ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              Your coach hasn&apos;t added the explanation for this moment yet.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** MOMENT_SUGGESTIONS — the grey-star card (free): a replace shows the
 *  alternative, an emphasize shows the "why it landed". Approve folds it into
 *  the text (reversible via Undo until the sheet closes). */
function MomentSuggestionCard({
  suggestion,
  applied,
  onApprove,
  onRevert,
}: {
  suggestion: Extract<MomentSuggestion, { kind: "emphasize" | "replace" }>;
  applied: boolean;
  onApprove: () => void;
  onRevert: () => void;
}) {
  const isReplace = suggestion.kind === "replace";
  if (applied) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 px-3 py-2.5">
          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] leading-relaxed text-foreground">
            {isReplace
              ? "Swapped into your text."
              : "Marked as a strong phrase in your text."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRevert}
          className="self-start text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {isReplace && suggestion.replacement ? (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {/* POLISH_AS_SUGGESTIONS — a polish is the compose LLM smoothing
                the flow, not a "your words were weak" rewrite, so it gets its
                own label. Absent trigger keeps today's copy (safe-ahead). */}
            {suggestion.trigger === "polish" ? "Smoother version" : "Try instead"}
          </p>
          <p className="text-[15px] leading-relaxed text-foreground">
            {suggestion.replacement}
          </p>
        </div>
      ) : null}
      {suggestion.why ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {suggestion.why}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={onApprove}
        className="h-10 self-start rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
      >
        Approve
      </Button>
    </div>
  );
}

/** STRUCTURAL_STARS — the amber-star card (free): a rhetorical device found in
 *  the user's own words, with the fixed practice prompt. Fixed, signed-off
 *  copy keyed off `device`; the quote is verbatim from their transcript. */
function StructuralPracticeCard({
  suggestion,
}: {
  suggestion: Extract<MomentSuggestion, { kind: "structure" }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-semibold text-foreground">Practice this:</p>
      <p className="text-[14px] leading-relaxed text-foreground">
        {suggestion.device === "contrast"
          ? "Contrast: Make the second half stand out."
          : "List of three: Make the last one count."}
      </p>
      {suggestion.quote ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-[14px] italic leading-relaxed text-foreground">
          &ldquo;{suggestion.quote}&rdquo;
        </p>
      ) : null}
    </div>
  );
}

/** DELIVERY_STARS — the fixed founder-approved copy keyed on the measured
 *  device. Self-referential ("your usual"), qualitative, no numbers. */
const DELIVERY_COPY: Record<
  Extract<MomentSuggestion, { kind: "delivery" }>["device"],
  string
> = {
  emphasis: "Emphasis: This came out flatter than your usual. Lift it.",
  pace_fast: "Pace: You moved faster here than you usually do. Slow it down.",
  pace_slow: "Pace: This one dragged compared to your usual. Pick it up.",
  pause: "Pause: You ran this together. Take a breath before it.",
};

/** DELIVERY_STARS — a measured observation + a mic to re-record THIS snippet
 *  with the feedback applied (not a text edit). The mic records in-modal and
 *  hands the blob to the host, which uploads + refetches. Degrades: no mic
 *  when onReRecord is absent (the flag is off / older host). */
function DeliveryStarCard({
  suggestion,
  snippetId,
  takeSessionId,
  onReRecord,
}: {
  suggestion: Extract<MomentSuggestion, { kind: "delivery" }>;
  snippetId: string;
  /** The snippet's spoken take — the read's REQUIRED pairing target. */
  takeSessionId: string;
  onReRecord?: (
    snippetId: string,
    takeSessionId: string,
    audio: Blob,
    durationSec: number
  ) => Promise<boolean>;
}) {
  const mic = useDualCaptureMic({ transcript: false });
  const [phase, setPhase] = useState<"idle" | "sending" | "done" | "failed">(
    "idle"
  );
  const sendingRef = useRef(false);
  // The blob we already handled — a PER-BLOB latch (review R-dl1). The upload
  // effect depends on onReRecord, whose identity flips whenever the host
  // re-renders (it bumps a refetch nonce on success). Without this latch that
  // re-render would re-run the effect on the SAME still-"stopped" blob and
  // re-upload it, bumping the nonce again → a runaway loop the instant the BE
  // endpoint returns 200. A fresh recording produces a new blob and re-arms.
  const sentBlobRef = useRef<Blob | null>(null);
  const st = mic.state;

  // Upload each recorded blob exactly once, whatever re-renders happen.
  useEffect(() => {
    if (
      st.status !== "stopped" ||
      sendingRef.current ||
      !onReRecord ||
      snippetId === "" ||
      takeSessionId === ""
    )
      return;
    const blob = st.audioBlob;
    if (!blob || blob.size === 0) {
      setPhase("failed");
      return;
    }
    if (sentBlobRef.current === blob) return; // already handled this take
    sendingRef.current = true;
    sentBlobRef.current = blob;
    setPhase("sending");
    void onReRecord(snippetId, takeSessionId, blob, st.durationSec).then((ok) => {
      sendingRef.current = false;
      setPhase(ok ? "done" : "failed");
    });
  }, [st, snippetId, takeSessionId, onReRecord]);

  const recording = st.status === "recording";
  // Both ids are load-bearing: paired_snippet_id labels the fold and
  // paired_session_id is the read's REQUIRED pairing target (a read without a
  // pair is invisible on every surface). A momentId-keyed moment can carry
  // either as "" — then show the observation without the mic (review R-dl3).
  const canReRecord = !!onReRecord && snippetId !== "" && takeSessionId !== "";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] leading-relaxed text-foreground">
        {DELIVERY_COPY[suggestion.device]}
      </p>
      {phase === "done" ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 px-3 py-2.5">
          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] leading-relaxed text-foreground">
            Got it. We&apos;re working your new take into the text.
          </p>
        </div>
      ) : canReRecord ? (
        <>
          <Button
            type="button"
            onClick={() =>
              recording ? void mic.stop() : void mic.start().catch(() => {})
            }
            disabled={phase === "sending"}
            className="h-11 self-start rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
          >
            <Mic className="mr-2 h-4 w-4" aria-hidden />
            {phase === "sending"
              ? "Sending…"
              : recording
                ? "Stop and send"
                : "Record it again"}
          </Button>
          {phase === "failed" ? (
            <p className="text-[12px] text-muted-foreground">
              Couldn&apos;t send that just now. Give it another go.
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Read just this line again, applying the note above.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

/** SD — the unlock prompt inside the moment sheet: one price, one button. A
 *  verified moment with a coach video shows a blurred teaser above it. */
function MomentUnlockPrompt({
  priceCredits,
  hasVideo,
  onBuy,
}: {
  priceCredits: number | null;
  hasVideo?: boolean;
  onBuy: () => Promise<string | null>;
}) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = priceCredits ?? 5;
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      {hasVideo ? (
        // The coach's video sits here, blurred until the unlock.
        <div className="relative w-full overflow-hidden rounded-xl">
          <div className="aspect-video w-full bg-gradient-to-br from-muted to-muted-foreground/40 blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-6 w-6 text-foreground/70" aria-hidden />
          </div>
        </div>
      ) : null}
      <p className="text-[14px] leading-relaxed text-foreground">
        See why these were your key moments, from your coach.
      </p>
      <Button
        type="button"
        onClick={() => {
          if (buying) return;
          setBuying(true);
          setError(null);
          void onBuy().then((err) => {
            setBuying(false);
            if (err) setError(err);
          });
        }}
        disabled={buying}
        className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
      >
        {buying ? "Unlocking…" : `Unlock for ${price} credits`}
      </Button>
      <p className="text-[12px] text-muted-foreground">
        One unlock opens every key moment in this presentation, now and later.
      </p>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}

/** The clean reading view in the medium style: bold key phrases, key-moment
 *  stars (grey = a suggestion to Approve, orange = coach-verified), no chrome.
 *  A just-approved suggestion renders its fold in place of the star.
 *
 *  Identical on the post-recording screen and in the notebook;
 *  `textSizeClass` is the only surface knob. */
export function MomentStarText({
  text,
  ideal,
  onMomentTap,
  foldFor,
  textSizeClass = "text-[18px]",
}: {
  text: string;
  ideal: IdealText;
  onMomentTap: (m: IdealKeyMomentLink) => void;
  /** The medium reading size by default (the notebook); the post-recording
   *  screen passes its own so the two surfaces keep their own scale. */
  textSizeClass?: string;
  /** MOMENT_SUGGESTIONS — a just-approved moment's optimistic local fold, or
   *  null to render the star. Keyed per moment (momentKey), never snippetId
   *  alone (R-ms1). Absent (instant/legacy lane) → never folded. */
  foldFor?: (m: IdealKeyMomentLink) => LocalFold | null;
}) {
  const segments = useMemo(
    () => segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
    [text, ideal.keyPhrases, ideal.keyMoments]
  );
  // FE-9 — an INLINE [[moment:…]] marker (coach-authored) is as tappable as an
  // anchor-based key moment: bridge RichText's {snippetId, sessionId} shape to
  // the shared IdealKeyMomentLink flow.
  const onInlineMoment = (m: { snippetId: string; sessionId: string }) =>
    onMomentTap({ anchor: "", snippetId: m.snippetId, takeSessionId: m.sessionId });
  return (
    <p className={`whitespace-pre-line leading-relaxed text-foreground ${textSizeClass}`}>
      {segments.map((s, i) => {
        if (s.moment) {
          const m = s.moment;
          const fold = foldFor?.(m) ?? null;
          // Approved suggestion — render its fold, no star (it "disappears").
          // Emphasize is bold+orange; replace is the plain rephrase.
          if (fold) {
            return fold.kind === "emphasize" ? (
              <strong key={i} className="font-semibold">
                <RichText text={fold.text} />
              </strong>
            ) : (
              <span key={i}>
                <RichText text={fold.text} />
              </span>
            );
          }
          const star = m.star;
          if (star === "suggestion" || star === "verified") {
            const verified = star === "verified";
            // AMBER = a PRACTICE prompt (structural device or a measured
            // delivery observation): a re-record/practice cue, never a text
            // edit. It must not look like the grey edit-suggestions or the
            // coach-verified orange.
            const k = m.suggestion?.kind;
            const practice = !verified && (k === "structure" || k === "delivery");
            return (
              <button
                key={i}
                type="button"
                onClick={() => onMomentTap(m)}
                aria-label={
                  verified
                    ? "Coach-verified moment"
                    : practice
                      ? "Practice suggestion"
                      : "Suggested edit"
                }
                className="inline align-baseline transition-colors hover:text-primary"
              >
                {/* No onMomentTap inside — never nest a button in a button. */}
                <RichText text={s.text} />
                <Star
                  className={`ml-0.5 inline h-3.5 w-3.5 -translate-y-1.5 ${
                    verified
                      ? "text-primary"
                      : practice
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  }`}
                  fill={verified || practice ? "currentColor" : "none"}
                  aria-hidden
                />
              </button>
            );
          }
          // Legacy underlined moment (no star field — today's behavior).
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMomentTap(m)}
              className="inline underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-primary"
            >
              <RichText text={s.text} />
            </button>
          );
        }
        if (s.bold) {
          return (
            <strong key={i} className="font-semibold">
              <RichText text={s.text} onMomentTap={onInlineMoment} />
            </strong>
          );
        }
        // FE-9 — the coach's inline markers (bold / italic / underline / orange
        // / moment links) render here too, identically to the coach preview,
        // instead of leaking raw marker syntax into the notebook.
        return (
          <span key={i}>
            <RichText text={s.text} onMomentTap={onInlineMoment} />
          </span>
        );
      })}
    </p>
  );
}


/** The moment sheet. Mounts nothing when no moment is open. Joins the
 *  back-dismiss LIFO so Back closes the sheet before the surface under it. */
export function MomentSheet({
  moment,
  momentContent,
  applied,
  onClose,
  onApprove,
  onRevert,
  onBuy,
  onReRecord,
}: {
  moment: IdealKeyMomentLink | null;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  onClose: () => void;
  onApprove: () => void;
  onRevert: () => void;
  onBuy: () => Promise<string | null>;
  /** DELIVERY_STARS — re-record this snippet with the feedback applied. */
  onReRecord?: (
    snippetId: string,
    takeSessionId: string,
    audio: Blob,
    durationSec: number
  ) => Promise<boolean>;
}) {
  if (!moment) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      {/* D-3 — the sheet joins the back-dismiss LIFO: Back closes the sheet
          first, not the surface underneath (R-sd5). */}
      <SheetBackDismiss onClose={onClose} />
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Key moment"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            Your key moment
          </p>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close key moment" />
        </div>
        <MomentSheetBody
          moment={moment}
          momentContent={momentContent}
          applied={applied}
          onApprove={onApprove}
          onRevert={onRevert}
          onBuy={onBuy}
          onReRecord={onReRecord}
        />
      </div>
    </div>
  );
}

/** The star layer's state machine: which sheet is open, its fetched content,
 *  and the optimistic fold map. Assumes the SD lane (the caller decides when
 *  stars are live); `momentsUnlocked` / `priceCredits` come from the host's
 *  SD state, and `onUnlocked` lets the host flip its own copy after a buy. */
export function useMomentStars({
  arcId,
  momentsUnlocked,
  priceCredits,
  onUnlocked,
}: {
  arcId: string;
  momentsUnlocked: boolean;
  priceCredits: number | null;
  onUnlocked?: () => void;
}) {
  const [momentOpen, setMomentOpen] = useState<IdealKeyMomentLink | null>(null);
  const [momentContent, setMomentContent] =
    useState<MomentExplanationResult | null>(null);
  const [appliedLocal, setAppliedLocal] = useState<Map<string, LocalFold>>(
    () => new Map()
  );
  // The keys "Approve all" folded, so Undo all reverts EXACTLY those and never
  // an individually-approved star (review R-p3). Per-star Undo shrinks it; when
  // it empties, the control offers "Approve all" again.
  const [bulkKeys, setBulkKeys] = useState<Set<string>>(() => new Set());
  // Staleness guard for the moment-explanation fetches: a slow response for a
  // closed/replaced sheet must never overwrite the currently open one (R-sd3).
  const momentReqRef = useRef(0);

  const loadMomentContent = useCallback(
    async (m: IdealKeyMomentLink) => {
      const req = ++momentReqRef.current;
      setMomentContent(null);
      const r = await fetchMomentExplanation(arcId, m.momentId ?? m.snippetId);
      if (momentReqRef.current === req) setMomentContent(r);
    },
    [arcId]
  );

  const openMoment = useCallback(
    async (m: IdealKeyMomentLink) => {
      setMomentOpen(m);
      // A grey suggestion star is FREE: its alternative + why + snippet audio
      // are already in the payload, so no coach fetch. Bump the request seq so
      // any in-flight coach fetch can't land in this sheet.
      if (m.star === "suggestion" && m.suggestion) {
        momentReqRef.current++;
        setMomentContent(null);
        return;
      }
      // Verified star (or a plain SD moment) — the coach message is paid.
      if (!momentsUnlocked) {
        momentReqRef.current++;
        setMomentContent({ kind: "locked", priceCredits });
        return;
      }
      await loadMomentContent(m);
    },
    [momentsUnlocked, priceCredits, loadMomentContent]
  );

  const closeMoment = useCallback(() => setMomentOpen(null), []);

  // Approve folds the suggestion optimistically (emphasize → bold+orange
  // phrase; replace → the rephrase) and records it; the star vanishes. The BE
  // folds it into the served text on the next fetch, so this local map only
  // bridges the gap. Reversible until the sheet closes (Undo).
  const approveMoment = useCallback((m: IdealKeyMomentLink) => {
    const sg = m.suggestion;
    // Only emphasize/replace fold the text. Structure and delivery are prompts,
    // not edits — nothing to fold.
    if (!sg || (sg.kind !== "emphasize" && sg.kind !== "replace")) return;
    const fold: LocalFold =
      sg.kind === "emphasize"
        ? { kind: "emphasize", text: emphasizeMarker(m.anchor) }
        : { kind: "replace", text: sg.replacement ?? m.anchor };
    setAppliedLocal((prev) => new Map(prev).set(momentKey(m), fold));
    void sendSuggestionFeedback({
      snippetId: m.snippetId,
      sessionId: m.takeSessionId,
      target: sg.kind === "emphasize" ? "moment_emphasize" : "moment_replace",
      action: "applied",
    });
  }, []);

  const revertMoment = useCallback((m: IdealKeyMomentLink) => {
    const sg = m.suggestion;
    if (!sg || (sg.kind !== "emphasize" && sg.kind !== "replace")) return;
    const key = momentKey(m);
    setAppliedLocal((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    // Leaving the bulk set keeps the control honest: undo every bulk-folded
    // star one by one and it returns to "Approve all".
    setBulkKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    void sendSuggestionFeedback({
      snippetId: m.snippetId,
      sessionId: m.takeSessionId,
      target: sg.kind === "emphasize" ? "moment_emphasize" : "moment_replace",
      action: "reverted",
    });
  }, []);

  const buyMoments = useCallback(async (): Promise<string | null> => {
    const r = await unlockMoments(arcId);
    if (r.ok) {
      onUnlocked?.();
      if (momentOpen) await loadMomentContent(momentOpen);
      return null;
    }
    if (r.reason === "insufficient") {
      // Top-ups live on the pricing page (hard navigation — the documented
      // forward-nav trap with stacked overlays' back-dismiss cleanup).
      window.location.assign("/dashboard/pricing");
      return null;
    }
    return r.message;
  }, [arcId, onUnlocked, momentOpen, loadMomentContent]);

  const foldFor = useCallback(
    (m: IdealKeyMomentLink) => appliedLocal.get(momentKey(m)) ?? null,
    [appliedLocal]
  );

  /** A different arc is a different entitlement question and a different text
   *  — never carry folds across. */
  const resetFolds = useCallback(() => {
    setAppliedLocal(new Map());
    setBulkKeys(new Set());
  }, []);

  // POLISH_AS_SUGGESTIONS — "Approve all" applies every un-applied POLISH star
  // in one tap. Polish only: flow smoothing is mechanical, while acoustic and
  // structural stars are judgment calls and stay strictly per-star (the
  // founder's no-apply-all rule still holds for them).
  const approveAllPolish = useCallback((moments: IdealKeyMomentLink[]) => {
    const targets = moments.filter(isUnappliedPolish);
    if (targets.length === 0) return;
    // One optimistic fold for the whole set, then N per-star writes: each
    // approval stays individually recorded and individually revertible, and a
    // partial failure just returns those stars on the next refetch.
    setAppliedLocal((prev) => {
      const next = new Map(prev);
      for (const m of targets) {
        const sg = m.suggestion;
        if (sg?.kind !== "replace") continue;
        next.set(momentKey(m), {
          kind: "replace",
          text: sg.replacement ?? m.anchor,
        });
      }
      return next;
    });
    setBulkKeys(new Set(targets.map(momentKey)));
    for (const m of targets) {
      void sendSuggestionFeedback({
        snippetId: m.snippetId,
        sessionId: m.takeSessionId,
        target: "moment_replace",
        action: "applied",
      });
    }
  }, []);

  /** Undo all — unfolds EXACTLY the stars "Approve all" folded and still holds
   *  folded, and records one revert each. Never touches a star the user
   *  approved individually, and never re-reverts one they already undid
   *  (review R-p3). Per-star Undo keeps working independently. */
  const revertAllPolish = useCallback(
    (moments: IdealKeyMomentLink[]) => {
      const targets = moments.filter(
        (m) => bulkKeys.has(momentKey(m)) && appliedLocal.has(momentKey(m))
      );
      setAppliedLocal((prev) => {
        const next = new Map(prev);
        for (const m of targets) next.delete(momentKey(m));
        return next;
      });
      setBulkKeys(new Set());
      for (const m of targets) {
        void sendSuggestionFeedback({
          snippetId: m.snippetId,
          sessionId: m.takeSessionId,
          target: "moment_replace",
          action: "reverted",
        });
      }
    },
    [bulkKeys, appliedLocal]
  );

  return {
    momentOpen,
    momentContent,
    appliedLocal,
    openMoment,
    closeMoment,
    approveMoment,
    revertMoment,
    buyMoments,
    foldFor,
    resetFolds,
    approveAllPolish,
    revertAllPolish,
    /** True while "Approve all" still holds folds — the control reads "Undo all". */
    bulkApplied: bulkKeys.size > 0,
    /** Convenience for the sheet's `applied` prop. */
    isApplied: (m: IdealKeyMomentLink) => appliedLocal.has(momentKey(m)),
  };
}
