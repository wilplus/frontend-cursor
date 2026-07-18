"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import {
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
}: {
  moment: IdealKeyMomentLink;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  onApprove: () => void;
  onRevert: () => void;
  onBuy: () => Promise<string | null>;
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
        <MomentSuggestionCard
          suggestion={suggestion}
          applied={applied}
          onApprove={onApprove}
          onRevert={onRevert}
        />
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
  suggestion: MomentSuggestion;
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
            Try instead
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
            return (
              <button
                key={i}
                type="button"
                onClick={() => onMomentTap(m)}
                aria-label={verified ? "Coach-verified moment" : "Suggested edit"}
                className="inline align-baseline transition-colors hover:text-primary"
              >
                {/* No onMomentTap inside — never nest a button in a button. */}
                <RichText text={s.text} />
                <Star
                  className={`ml-0.5 inline h-3.5 w-3.5 -translate-y-1.5 ${
                    verified ? "text-primary" : "text-muted-foreground"
                  }`}
                  fill={verified ? "currentColor" : "none"}
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
}: {
  moment: IdealKeyMomentLink | null;
  momentContent: MomentExplanationResult | null;
  applied: boolean;
  onClose: () => void;
  onApprove: () => void;
  onRevert: () => void;
  onBuy: () => Promise<string | null>;
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
    if (!sg) return;
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
    if (!sg) return;
    setAppliedLocal((prev) => {
      const next = new Map(prev);
      next.delete(momentKey(m));
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
  const resetFolds = useCallback(() => setAppliedLocal(new Map()), []);

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
    /** Convenience for the sheet's `applied` prop. */
    isApplied: (m: IdealKeyMomentLink) => appliedLocal.has(momentKey(m)),
  };
}
