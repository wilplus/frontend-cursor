"use client";

import { useMemo, useState } from "react";
import { Check, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { WHY_COPY } from "./PieceBadges";
import { DELIVERY_COPY } from "./MomentStars";
import { RichText } from "./RichText";
import { buildTrackedSegments } from "@/lib/willab/trackedChanges";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  TrackedText — the LIVING TRANSCRIPT's tracked changes (founder 2026-07-20) */
/*                                                                            */
/*  The document is the FULL literal transcript. Every word change is visible: */
/*    replace → the fragment renders struck through with the proposed text     */
/*              right after it, highlighted. Tap either → the popover with the */
/*              reason and Accept / Keep mine. Accept: the struck text goes    */
/*              and the proposal stays as plain text. Keep: both revert to the */
/*              original words.                                                */
/*    bold    → the span previews its emphasis in place (sub-sentence spans    */
/*              included), same popover.                                       */
/*    advice  → NOT rendered here at all: delivery/structural coaching keeps    */
/*              the existing star + modal treatment (resolveTrackedSuggestions */
/*              filters it out).                                               */
/*                                                                            */
/*  Safety (FE-5): every suggestion is verified against its quote before it is */
/*  drawn, so a stale span drops silently rather than striking wrong words.    */
/*  Decisions are reported to the server and the decided suggestion never      */
/*  renders again in this session.                                             */
/* -------------------------------------------------------------------------- */

/** The lead line above the reason, by lane. `prior_take` is the cross-take
 *  discernment suggestion (FE-4). Copy pending founder sign-off. */
/** advice — the SAME founder-approved copy the star modal already uses, keyed
 *  off the device (BE-C). Structural devices keep their own two lines. */
function adviceCopy(s: DocumentSuggestion): string | null {
  const d = s.device;
  if (!d) return null;
  if (d === "contrast") return "Contrast: Make the second half stand out.";
  if (d === "list_of_three") return "List of three: Make the last one count.";
  return DELIVERY_COPY[d];
}

function leadLine(s: DocumentSuggestion): string {
  if (s.source === "prior_take") return "Your previous version landed better here.";
  if (s.source === "profanity") return "This might land differently than you meant.";
  if (s.kind === "bold") return "Worth leaning on these words.";
  return "A smoother way to say this.";
}

export type TrackedDecision = "accept" | "keep";

export function TrackedText({
  text,
  suggestions,
  onDecide,
  trailing,
  textSizeClass = "text-[17px]",
}: {
  text: string;
  suggestions: DocumentSuggestion[] | null;
  /** Report the decision. Returning false leaves the suggestion on screen
   *  (the save failed), so the student can try again. */
  onDecide: (s: DocumentSuggestion, d: TrackedDecision) => Promise<boolean>;
  /** Rendered inside the closing paragraph — the discernment version pill
   *  sits inline at the paragraph's end, same slot as MomentStarText. */
  trailing?: React.ReactNode;
  textSizeClass?: string;
}) {
  // Decided in THIS session: accepted ones render their proposal as plain
  // text, kept ones render the original. Either way the tracked change is
  // gone — the next server fetch agrees (decisions are remembered).
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState<DocumentSuggestion | null>(null);

  // Every span stays in place; a DECIDED one simply renders as plain text —
  // accepted shows the proposal (the new words), kept shows the original.
  // Nothing is hidden from the segmenter, so the paragraph never reflows away
  // from the reader mid-decision.
  const segments = useMemo(
    () => buildTrackedSegments(text, suggestions),
    [text, suggestions]
  );

  return (
    <>
      <p
        className={`whitespace-pre-line leading-relaxed text-foreground ${textSizeClass}`}
      >
        {segments.map((seg, i) => {
          const s = seg.suggestion;
          // FE-9 markers must render as FORMATTING, never as literal syntax:
          // the served text can carry baked **bold** / {{orange:…}} folds.
          if (!s) return <RichText key={i} text={seg.text} />;
          if (accepted.has(s.id)) {
            // Accepted: the crossed text is gone, the proposal is now just
            // the student's text (bold keeps its emphasis).
            return s.kind === "bold" ? (
              <strong key={i} className="font-semibold">
                <RichText text={seg.text} />
              </strong>
            ) : (
              <span key={i}>
                <RichText text={s.proposedText ?? ""} />
              </span>
            );
          }
          if (kept.has(s.id)) return <RichText key={i} text={seg.text} />;
          if (s.kind === "advice") {
            // FE-3 — coaching, NOT a text change: the amber star + modal it
            // has always had. No strike, no Accept.
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(s)}
                className="inline text-left transition-colors hover:text-primary"
              >
                <RichText text={seg.text} />
                <Star
                  className="ml-0.5 inline h-3.5 w-3.5 -translate-y-1.5 text-amber-500"
                  fill="currentColor"
                  aria-hidden
                />
                <span className="sr-only">, practice suggestion</span>
              </button>
            );
          }
          if (s.kind === "bold") {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(s)}
                className="inline text-left font-semibold text-foreground underline decoration-dotted decoration-2 underline-offset-4 transition-colors hover:text-primary"
              >
                <RichText text={seg.text} />
                <span className="sr-only">, suggested emphasis</span>
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(s)}
              className="inline text-left transition-opacity hover:opacity-80"
            >
              <span className="text-muted-foreground line-through decoration-muted-foreground/70">
                <RichText text={seg.text} />
              </span>{" "}
              <span className="rounded bg-primary/10 px-0.5 text-primary">
                <RichText text={s.proposedText ?? ""} />
              </span>
              <span className="sr-only">, suggested change</span>
            </button>
          );
        })}
        {trailing}
      </p>
      {open ? (
        <TrackedPopover
          suggestion={open}
          onClose={() => setOpen(null)}
          onDecide={async (d) => {
            const ok = await onDecide(open, d);
            if (!ok) return false;
            if (d === "accept") {
              setAccepted((prev) => new Set(prev).add(open.id));
            } else {
              setKept((prev) => new Set(prev).add(open.id));
            }
            setOpen(null);
            return true;
          }}
        />
      ) : null}
    </>
  );
}

/** The tap target's popover: what changed, why, and the two decisions. */
function TrackedPopover({
  suggestion,
  onClose,
  onDecide,
}: {
  suggestion: DocumentSuggestion;
  onClose: () => void;
  onDecide: (d: TrackedDecision) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useBackDismiss(onClose, () => busy);
  const close = () => {
    if (!busy) onClose();
  };
  const why = suggestion.why ? WHY_COPY[suggestion.why] : null;
  const decide = (d: TrackedDecision) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onDecide(d).then((ok) => {
      setBusy(false);
      if (!ok) setFailed(true);
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Suggested change"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            {suggestion.kind === "advice"
              ? "Practice this"
              : suggestion.kind === "bold"
                ? "Suggested emphasis"
                : "Suggested change"}
          </p>
          <OverlayCloseButton onClick={close} ariaLabel="Close suggestion" />
        </div>
        <div className="flex flex-col gap-3">
          {suggestion.kind === "replace" ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What you said
                </p>
                <p className="text-[15px] leading-relaxed text-foreground">
                  {stripRichMarkers(suggestion.quote)}
                </p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-primary">
                  Suggested
                </p>
                <p className="text-[15px] leading-relaxed text-foreground">
                  {stripRichMarkers(suggestion.proposedText ?? "")}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-[15px] font-semibold leading-relaxed text-foreground">
                {stripRichMarkers(suggestion.quote)}
              </p>
            </div>
          )}
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {suggestion.kind === "advice"
              ? adviceCopy(suggestion)
              : `${leadLine(suggestion)}${why ? ` ${why}` : ""}`}
          </p>
          {suggestion.kind === "advice" ? null : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => decide("accept")}
              disabled={busy}
              className="h-10 flex-1 rounded-full bg-foreground text-[14px] text-background hover:bg-foreground/90"
            >
              <Check className="mr-1.5 h-4 w-4" aria-hidden />
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => decide("keep")}
              disabled={busy}
              className="h-10 flex-1 rounded-full text-[14px]"
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden />
              Keep mine
            </Button>
          </div>
          )}
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              Couldn&apos;t save that just now. Give it another go.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
