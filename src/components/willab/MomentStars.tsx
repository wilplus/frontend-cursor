"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Mic, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText, type MomentDecor } from "./RichText";
import { markerTokenSpans } from "@/lib/willab/richMarkers";
import {
  isUnappliedPolish,
  segmentIdealText,
  type IdealKeyMomentLink,
  type IdealSegment,
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

/** FE-2 — split `text` around the first occurrence of `quote`, refusing a
 *  split that would slice a rich-marker token in half (leaking raw syntax).
 *  A token FULLY inside the quote is fine — the underline just spans it. */
function splitOnQuote(
  text: string,
  quote: string
): [string, string, string] | null {
  const at = text.indexOf(quote);
  if (at < 0) return null;
  const end = at + quote.length;
  const slices = markerTokenSpans(text).some(
    ([ts, te]) => (at > ts && at < te) || (end > ts && end < te)
  );
  if (slices) return null;
  return [text.slice(0, at), quote, text.slice(end)];
}

/** FE-2 — the narrow underline span behind a grey edit star, or null (icon
 *  only). Practice families never underline: delivery carries no quote, and a
 *  structural quote stays a sheet excerpt (unchanged by this pass). */
function quoteOf(m: IdealKeyMomentLink): string | null {
  const sg = m.suggestion;
  return m.star === "suggestion" &&
    sg &&
    (sg.kind === "emphasize" || sg.kind === "replace")
    ? sg.quote
    : null;
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
  readOnly,
  onApprove,
  onRevert,
  onBuy,
  onReRecord,
}: {
  moment: IdealKeyMomentLink;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  /** FE-3b — a historical step is a record, not a workbench: suggestion
   *  cards show their reasoning without Approve, and the host omits the
   *  re-record mic. */
  readOnly?: boolean;
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
            readOnly={readOnly}
            onApprove={onApprove}
            onRevert={onRevert}
          />
        )
      ) : momentContent === null ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Loading…
        </p>
      ) : momentContent.kind === "unavailable" ? (
        // FE-1 — no coach explanation exists yet: the free playback above is
        // the whole sheet. No unlock CTA, no price, no locks — there is
        // nothing behind them. Without playback either, say so honestly
        // (reuses the existing line) instead of an empty dialog.
        moment.snippetAudioRef ? null : (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Your coach hasn&apos;t added the explanation for this moment yet.
          </p>
        )
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
  readOnly,
  onApprove,
  onRevert,
}: {
  suggestion: Extract<MomentSuggestion, { kind: "emphasize" | "replace" }>;
  applied: boolean;
  /** FE-3b — historical steps show the reasoning only: no Approve, no Undo
   *  (there is no local fold on a frozen version). */
  readOnly?: boolean;
  onApprove: () => void;
  onRevert: () => void;
}) {
  const isReplace = suggestion.kind === "replace";
  if (applied && !readOnly) {
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
      {readOnly ? null : (
        <Button
          type="button"
          onClick={onApprove}
          className="h-10 self-start rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
        >
          Approve
        </Button>
      )}
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
      {/* D-3 — the rule-of-three tag: "123" marks a list-of-three device. */}
      {suggestion.device === "list_of_three" ? (
        <span className="w-fit rounded-md bg-amber-500/15 px-2 py-0.5 text-[12px] font-bold tabular-nums tracking-[0.12em] text-amber-700 dark:text-amber-300">
          123
        </span>
      ) : null}
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

/** DELIVERY_STARS — the fixed founder-approved copy keyed on the device.
 *  Qualitative, no numbers. The four measured devices are self-referential
 *  ("your usual"); `congruence` compares the delivery to the SPEAKER'S OWN
 *  WORDS instead, which is the only reference that case has. */
export const DELIVERY_COPY: Record<
  Extract<MomentSuggestion, { kind: "delivery" }>["device"],
  string
> = {
  emphasis: "Emphasis: This came out flatter than your usual. Lift it.",
  pace_fast: "Pace: You moved faster here than you usually do. Slow it down.",
  pace_slow: "Pace: This one dragged compared to your usual. Pick it up.",
  pause: "Pause: You ran this together. Take a breath before it.",
  // Founder-signed-off 2026-07-26. Hedged on purpose: the read is a
  // content↔delivery gap, not a verdict on the speaker. "Worth another take"
  // pairs with the card's re-record mic.
  congruence:
    "Match: Your delivery landed flatter than your words here. Worth another take.",
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
      {/* D-3 — the pace tag: an at-a-glance arrow for the measured pace device
          (pace_fast = moved faster = up; pace_slow = dragged = down). */}
      {suggestion.device === "pace_fast" || suggestion.device === "pace_slow" ? (
        <span className="inline-flex w-fit items-center gap-0.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
          pace {suggestion.device === "pace_fast" ? "↑" : "↓"}
        </span>
      ) : null}
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
  sdStars,
  segments: preSegmented,
  trailing,
  textSizeClass = "text-[18px]",
}: {
  text: string;
  ideal: IdealText;
  onMomentTap: (m: IdealKeyMomentLink) => void;
  /** DISCERNMENT — pre-computed segments (document-level matching sliced per
   *  paragraph by PieceBadgeText). Overrides local segmentation so an anchor
   *  can never re-match in every paragraph it textually appears in. */
  segments?: IdealSegment[];
  /** Rendered INSIDE the closing paragraph, after the last segment — the
   *  version pill sits inline at the paragraph's end, not on its own line. */
  trailing?: React.ReactNode;
  /** The medium reading size by default (the notebook); the post-recording
   *  screen passes its own so the two surfaces keep their own scale. */
  textSizeClass?: string;
  /** MOMENT_SUGGESTIONS — a just-approved moment's optimistic local fold, or
   *  null to render the star. Keyed per moment (momentKey), never snippetId
   *  alone (R-ms1). Absent (instant/legacy lane) → never folded. */
  foldFor?: (m: IdealKeyMomentLink) => LocalFold | null;
  /** FE-2 (gradual refinement) — the SD star treatment: [[moment:…]] wrapper
   *  spans and anchors are NEVER underlined; the star icon at the span's end
   *  is the affordance, and only a suggestion's narrow `quote` underlines.
   *  Absent (instant/ready lanes): the classic underline links stay. */
  sdStars?: boolean;
}) {
  const localSegments = useMemo(
    () =>
      preSegmented ?? segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
    [preSegmented, text, ideal.keyPhrases, ideal.keyMoments]
  );
  const segments = localSegments;
  // The wrapper-id → payload-moment index. The SD text wraps every key moment
  // in [[moment:snip|sess]] markers, so both the star decor AND the tap must
  // resolve the wrapper's ids to the FULL payload moment (suggestion, audio,
  // star) — a moment can share a snippet, hence pair-first with a snippet
  // fallback.
  const momentIndex = useMemo(() => {
    const byPair = new Map<string, IdealKeyMomentLink>();
    const bySnip = new Map<string, IdealKeyMomentLink>();
    for (const m of ideal.keyMoments) {
      const pair = `${m.snippetId}|${m.takeSessionId}`;
      if (!byPair.has(pair)) byPair.set(pair, m);
      if (m.snippetId && !bySnip.has(m.snippetId)) bySnip.set(m.snippetId, m);
    }
    return { byPair, bySnip };
  }, [ideal.keyMoments]);
  const resolveWrapped = (w: {
    snippetId: string;
    sessionId: string;
  }): IdealKeyMomentLink | null =>
    momentIndex.byPair.get(`${w.snippetId}|${w.sessionId}`) ??
    momentIndex.bySnip.get(w.snippetId) ??
    null;
  // FE-9 — an INLINE [[moment:…]] marker is as tappable as an anchor-based key
  // moment. Resolve to the payload moment when it exists (so the sheet gets
  // the suggestion / audio / star, not an empty bridge — a grey star's tap
  // must open its FREE card, never the paid path); a coach-authored link with
  // no payload row falls back to the bare bridge as before.
  const onInlineMoment = (w: { snippetId: string; sessionId: string }) =>
    onMomentTap(
      resolveWrapped(w) ?? {
        anchor: "",
        snippetId: w.snippetId,
        takeSessionId: w.sessionId,
      }
    );
  // FE-2 — the star treatment for wrapper spans: hand RichText each moment's
  // decor. Not in the current payload (baked/consumed, or an id drift) → null
  // → plain text: the view renders exactly the CURRENT GET's stars, nothing
  // cached or merged across versions (FE-3a). A locally folded (just-approved)
  // moment also decors null — its star vanishes the moment Approve lands.
  const decorFor = useMemo(() => {
    if (!sdStars) return undefined;
    return (w: { snippetId: string; sessionId: string }): MomentDecor | null => {
      const m = resolveWrapped(w);
      if (!m) return null;
      // A just-approved moment hands its optimistic fold to the renderer —
      // the run repaints as the folded text (star gone) instead of silently
      // keeping the old words while the sheet claims a swap happened.
      const fold = foldFor?.(m);
      if (fold) return { star: null, quote: null, fold };
      const k = m.suggestion?.kind;
      const star =
        m.star === "verified"
          ? ("verified" as const)
          : m.star === "suggestion"
            ? k === "structure" || k === "delivery"
              ? ("practice" as const)
              : ("suggestion" as const)
            : null;
      return { star, quote: quoteOf(m) };
    };
    // resolveWrapped closes over momentIndex — the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdStars, momentIndex, foldFor]);
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
            // FE-2 — a suggestion's narrow quote is the ONLY underline; the
            // anchor span itself never underlines. Quote absent / not found /
            // marker-slicing → icon only.
            const quote = quoteOf(m);
            const parts = quote ? splitOnQuote(s.text, quote) : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onMomentTap(m)}
                // No aria-label: it would REPLACE the accessible name and
                // erase the anchor text for screen readers — the content
                // names the button, the sr-only suffix adds the family.
                className={`inline align-baseline transition-opacity hover:opacity-80${
                  sdStars ? " text-left" : ""
                }`}
              >
                {/* No onMomentTap inside — never nest a button in a button. */}
                {parts ? (
                  <>
                    <RichText text={parts[0]} />
                    <span className="underline decoration-2 underline-offset-4">
                      <RichText text={parts[1]} />
                    </span>
                    <RichText text={parts[2]} />
                  </>
                ) : (
                  <RichText text={s.text} />
                )}
                {/* Two states only (founder 2026-07-22): coach-verified is a
                    FILLED YELLOW star; every unverified suggestion — text,
                    delivery, structural, tracked change alike — is an EMPTY
                    one. The kind never changes the icon. */}
                <Star
                  className={`ml-0.5 inline h-3.5 w-3.5 -translate-y-1.5 ${
                    verified ? "text-yellow-400" : "text-muted-foreground"
                  }`}
                  fill={verified ? "currentColor" : "none"}
                  aria-hidden
                />
                <span className="sr-only">
                  ,{" "}
                  {verified
                    ? "Coach-verified moment"
                    : practice
                      ? "Practice suggestion"
                      : "Suggested edit"}
                </span>
              </button>
            );
          }
          // Plain moment (no star). FE-2: under the SD treatment anchors are
          // never underline targets — a quiet grey star marks the spot and
          // keeps the playback sheet reachable. Legacy lanes (instant/ready)
          // keep the classic underline link, their only affordance.
          if (sdStars) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onMomentTap(m)}
                className="inline align-baseline text-left transition-opacity hover:opacity-80"
              >
                <RichText text={s.text} />
                {/* No `star` value → NO star icon (founder 2026-07-22). The
                    moment stays tappable so playback is still reachable. */}
                <span className="sr-only">, Key moment</span>
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMomentTap(m)}
              className="inline underline decoration-primary decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
            >
              <RichText text={s.text} />
            </button>
          );
        }
        if (s.bold) {
          return (
            <strong key={i} className="font-semibold">
              <RichText
                text={s.text}
                onMomentTap={onInlineMoment}
                momentDecor={decorFor}
              />
            </strong>
          );
        }
        // FE-9 — the coach's inline markers (bold / italic / underline / orange
        // / moment links) render here too, identically to the coach preview,
        // instead of leaking raw marker syntax into the notebook. Under the SD
        // treatment (decorFor set) the [[moment:…]] wrapper spans — which the
        // BE emits around EVERY key moment, whole paragraphs included — render
        // as plain text + a star, never the old full-span dotted underline.
        return (
          <span key={i}>
            <RichText
              text={s.text}
              onMomentTap={onInlineMoment}
              momentDecor={decorFor}
            />
          </span>
        );
      })}
      {trailing}
    </p>
  );
}


/** The moment sheet. Mounts nothing when no moment is open. Joins the
 *  back-dismiss LIFO so Back closes the sheet before the surface under it. */
export function MomentSheet({
  moment,
  momentContent,
  applied,
  readOnly,
  onClose,
  onApprove,
  onRevert,
  onBuy,
  onReRecord,
}: {
  moment: IdealKeyMomentLink | null;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  /** FE-3b — read-only historical step: reasoning without actions. */
  readOnly?: boolean;
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
          readOnly={readOnly}
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
  explanationsAvailable,
  onUnlocked,
}: {
  arcId: string;
  momentsUnlocked: boolean;
  priceCredits: number | null;
  /** FE-1 — true only when coach explanations actually exist behind the
   *  unlock. false → a locked moment shows NO paywall (kind "unavailable"):
   *  nothing is for sale yet. */
  explanationsAvailable: boolean;
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
      // FE-1: sell it ONLY when something actually exists behind the unlock;
      // otherwise the sheet stays free-content-only, no paywall anywhere.
      if (!momentsUnlocked) {
        momentReqRef.current++;
        setMomentContent(
          explanationsAvailable
            ? { kind: "locked", priceCredits }
            : { kind: "unavailable" }
        );
        return;
      }
      await loadMomentContent(m);
    },
    [momentsUnlocked, explanationsAvailable, priceCredits, loadMomentContent]
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
