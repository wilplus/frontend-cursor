"use client";

import { Bookmark } from "lucide-react";
import type { ChunkStatus } from "@/lib/willab/deckChunks";

/* One feedback control per paragraph. The icon describes the user's feedback
 * state; it does not grade the words and it is not an edit button:
 *
 *   no icon    resolved ordinary paragraph
 *   outline    a decision is waiting
 *   filled     an accepted flagship
 *   attention  an accepted flagship has a new decision waiting
 *
 * Slide editing has its own explicit, slide-scoped control. That separation is
 * deliberate: feedback, accepted orange anchors, and rehearsal roots are three
 * different layers of the product. */

const ARIA: Record<ChunkStatus, string> = {
  clean: "No feedback pending",
  waiting: "Feedback waiting — review it",
  locked: "Paragraph protected",
};

const COACH_LABEL = "Coach note:";
const STYLE_LABEL = "Style";

export default function DeckLockMark({
  status,
  pendingCount = 0,
  flagship = false,
  onClick,
  disabled = false,
  hasCoach = false,
  hasStyle = false,
  reviewStatus = null,
}: {
  status: ChunkStatus;
  /** Number selected for this chunk from the Take's immutable three. */
  pendingCount?: number;
  /** True only when the paragraph contains user-accepted orange text. */
  flagship?: boolean;
  onClick: () => void;
  disabled?: boolean;
  hasCoach?: boolean;
  hasStyle?: boolean;
  reviewStatus?:
    | "pending_coach_review"
    | "coach_reviewed"
    | "not_confirmed"
    | null;
}) {
  const styled = hasStyle && status === "locked";
  const reviewNeedsAttention =
    reviewStatus === "pending_coach_review" || reviewStatus === "not_confirmed";
  const unresolved = status === "waiting" || styled || hasCoach || reviewNeedsAttention;
  const attention = flagship && unresolved;

  // A neutral paragraph with no remaining action has no feedback icon. The
  // paragraph still has a neutral rehearsal root, and the slide remains
  // editable through “Edit the text”.
  if (!flagship && !unresolved) return null;

  return (
    <button
      type="button"
      aria-label={[
        flagship ? "Flagship accepted" : ARIA[status],
        status === "waiting" && pendingCount > 0
          ? `${pendingCount} feedback item${pendingCount === 1 ? "" : "s"}`
          : null,
        hasCoach ? COACH_LABEL : null,
        reviewStatus === "pending_coach_review" ? "Pending coach review" : null,
        reviewStatus === "coach_reviewed" ? "Coach reviewed" : null,
        reviewStatus === "not_confirmed" ? "Coach did not confirm this moment" : null,
        styled ? STYLE_LABEL : null,
      ]
        .filter(Boolean)
        .join(" — ")}
      data-status={attention ? "attention" : flagship ? "filled" : "outline"}
      data-coach={hasCoach ? "true" : undefined}
      data-style={styled ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`relative ml-1.5 inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-1 align-[0.05em] text-primary transition-transform hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
        attention
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:animate-lock-breathe"
          : ""
      }`}
    >
      <Bookmark
        className="h-5 w-5"
        strokeWidth={2.1}
        fill={flagship ? "currentColor" : "none"}
        aria-hidden
      />
      {status === "waiting" && pendingCount > 1 ? (
        <span className="pr-1 text-[11px] font-semibold tabular-nums" aria-hidden>
          {Math.min(3, pendingCount)}
        </span>
      ) : null}
      {reviewStatus === "pending_coach_review" ? (
        <span className="pr-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
          Pending
        </span>
      ) : null}
      {hasCoach ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
