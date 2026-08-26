"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import { useBackDismiss } from "./useBackDismiss";
import {
  fetchArcFeedback,
  groupKeyMomentsBySlide,
  type ArcFeedback,
  type FeedbackKeyMoment,
  type FeedbackTake,
} from "@/services/api/arcFeedback";

/* -------------------------------------------------------------------------- */
/*  FeedbackOverlay — one take's published feedback (delivery layer)           */
/*                                                                            */
/*  Opened from a grey `feedback` bubble (take 1/2/3), the trainings take      */
/*  list, or an ideal-text key-moment deep-link. Anatomy:                      */
/*    1. The take's coach-verified full text — all together, NO playback.      */
/*    2. Key moments, grouped per slide (one group when ≤1 slide): each is a   */
/*       playback of that snippet + the coach's comment (text and/or video).   */
/*  No suggestions, no scores (AC-9).                                          */
/*                                                                            */
/*  METERED, AND DELIBERATELY NOT PRICED ON THE TRIGGER.                       */
/*  Under token pricing the BE charges the `insights` price when this overlay's */
/*  GET runs (1,000 today), ONCE PER ARC — `ref_id` is the arc id, so every     */
/*  re-open of the same arc is free. That idempotency is exactly why there is   */
/*  no price on the bubble that opens this: a static label would be right the   */
/*  first time and wrong every time after, and a stale price on a control is    */
/*  worse than none, because people act on it. It would also discourage         */
/*  re-reading feedback they have already paid for.                             */
/*                                                                            */
/*  Pricing it honestly needs an "already charged for this arc" flag on the     */
/*  payload; until then `fetchArcFeedback` re-reads the balance after the       */
/*  charge so the drop is never unexplained. The token moments                  */
/*  unlock on the ideal text remains the only thing that is priced up front.    */
/*                                                                            */
/*  Each key moment is anchor-addressable (`moment-<snippetId>`) so the ideal  */
/*  text's underlined moments can deep-link here.                              */
/* -------------------------------------------------------------------------- */

export default function FeedbackOverlay({
  arcId,
  takeSessionId = null,
  takeIndex = null,
  anchorSnippetId = null,
  onClose,
  topLayer = false,
}: {
  arcId: string;
  /** Pick the take by session id (bubble metadata) or by index; first take
   *  when neither matches. */
  takeSessionId?: string | null;
  takeIndex?: number | null;
  /** Scroll to this key moment on load (the ideal-text deep-link). */
  anchorSnippetId?: string | null;
  onClose: () => void;
  /** True when stacked over another overlay (ideal text → feedback). */
  topLayer?: boolean;
}) {
  // D-3 invariant — the device Back gesture closes THIS overlay (LIFO with any
  // overlay underneath) instead of walking off /chat.
  useBackDismiss(onClose);
  const [data, setData] = useState<ArcFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchArcFeedback(arcId).then((r) => {
      if (!active) return;
      setData(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  const take: FeedbackTake | null = (() => {
    if (!data || data.takes.length === 0) return null;
    if (takeSessionId) {
      const bySession = data.takes.find((t) => t.sessionId === takeSessionId);
      if (bySession) return bySession;
    }
    if (takeIndex !== null) {
      const byIndex = data.takes.find((t) => t.takeIndex === takeIndex);
      if (byIndex) return byIndex;
    }
    return data.takes[0];
  })();

  // Deep-link: once the take is rendered, scroll its anchored moment into view.
  useEffect(() => {
    if (!anchorSnippetId || loading || !take) return;
    const el = document.getElementById(`moment-${anchorSnippetId}`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [anchorSnippetId, loading, take]);

  const title = take ? `Feedback · Take ${take.takeIndex}` : "Feedback";

  return (
    <div
      className={`fixed inset-0 flex flex-col bg-background ${
        topLayer ? "z-50" : "z-40"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <OverlayCloseButton onClick={onClose} />
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-6">
          {loading ? (
            <LoadingState placement="surface" />
          ) : !take ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Your coach is still putting this feedback together. Check back
              soon.
            </p>
          ) : (
            <TakeFeedback take={take} anchorSnippetId={anchorSnippetId} />
          )}
        </div>
      </div>
    </div>
  );
}

function TakeFeedback({
  take,
  anchorSnippetId,
}: {
  take: FeedbackTake;
  anchorSnippetId: string | null;
}) {
  const groups = groupKeyMomentsBySlide(take.keyMoments);
  // "Grouped per slide, all under one when ≤1 slide": only label the groups
  // when there genuinely is more than one slide to distinguish.
  const labelGroups = groups.length > 1;

  return (
    <div className="flex flex-col gap-8">
      {/* 1 — the coach-verified full text, all together, no playback. */}
      {take.fullText ? (
        <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
          {take.fullText}
        </p>
      ) : null}

      {/* 2 — key moments per slide. */}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-6">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Key moments
          </p>
          {groups.map((g) => (
            <div key={g.slideIndex ?? "general"} className="flex flex-col gap-5">
              {labelGroups ? (
                <p className="text-[13px] font-semibold text-foreground">
                  {g.slideIndex !== null
                    ? `Slide ${g.slideIndex + 1}`
                    : "Other moments"}
                </p>
              ) : null}
              {g.moments.map((m) => (
                <KeyMomentBlock
                  key={m.snippetId}
                  moment={m}
                  highlight={m.snippetId === anchorSnippetId}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {!take.fullText && groups.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted-foreground">
          Your coach didn&apos;t mark anything extra on this take.
        </p>
      ) : null}
    </div>
  );
}

/** One key moment: playback of the exact span + the coach's written comment.
 *  A "Read" chip marks moments from a re-read recording. */
function KeyMomentBlock({
  moment,
  highlight,
}: {
  moment: FeedbackKeyMoment;
  highlight: boolean;
}) {
  return (
    <div
      id={`moment-${moment.snippetId}`}
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 ${
        highlight ? "border-primary/60 bg-primary/[0.04]" : "border-border"
      }`}
    >
      {moment.recordingKind === "read" ? (
        <span className="self-start rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          Read
        </span>
      ) : null}

      {moment.audioRef && moment.durationMs > 0 ? (
        <MediaPlayer
          src={moment.audioRef}
          startOffsetMs={moment.startOffsetMs}
          durationMs={moment.durationMs}
        />
      ) : null}

      {moment.transcript ? (
        <p className="text-[15px] leading-relaxed text-foreground">
          {moment.transcript}
        </p>
      ) : null}

      {moment.commentText ? (
        <div className="flex items-start gap-2 border-t border-border pt-3">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="text-[14px] leading-relaxed text-foreground">
            {moment.commentText}
          </p>
        </div>
      ) : null}

    </div>
  );
}
