"use client";

import { Bookmark } from "lucide-react";
import type { ChunkStatus } from "@/lib/willab/deckChunks";

/* One feedback control per paragraph. The icon describes the user's feedback
 * state; it does not grade the words and it is not an edit button:
 *
 *   outline    resolved ordinary paragraph / feedback not loaded yet
 *   filled     a rooting phrase is active
 *   attention  something is waiting on this paragraph
 *
 * NO COUNT (founder 2026-09-15). The mark used to print a small 2 or 3 beside
 * the bookmark. It hid below two and clamped above three, so it was never a
 * true count — and a column of paragraphs reading 3 / 1 / 2 scans as a ranking
 * of how bad each paragraph is, which is the exact reading AC-9 exists to
 * prevent. The state is binary now: something is waiting, or it is not.
 *
 * ATTENTION IS NOW PLAIN `unresolved`, not `flagship && unresolved`. While the
 * number existed, a paragraph with feedback waiting but no rooting phrase drew
 * an ordinary outline mark and the digit was the only thing distinguishing it.
 * Removing the count without this change would have made those paragraphs
 * indistinguishable from resolved ones — the ring and the breathe now carry
 * the signal for every paragraph, with or without an orange anchor.
 *
 * Screen readers keep "Feedback waiting — review it" from ARIA below: the same
 * information, minus the number.
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
  flagship = false,
  onClick,
  disabled = false,
  hasCoach = false,
  hasUnreadCoachUpdate = false,
  hasStyle = false,
  reviewStatus = null,
}: {
  status: ChunkStatus;
  /** True when the paragraph contains an active orange rooting phrase.
   * Its automatic/owner origin remains separate server provenance. */
  flagship?: boolean;
  onClick: () => void;
  disabled?: boolean;
  hasCoach?: boolean;
  hasUnreadCoachUpdate?: boolean;
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
  // Anything waiting on this paragraph, from any layer. Since 2026-09-15 this
  // alone drives the ring — see the note above on why it is no longer gated on
  // `flagship`.
  const attention =
    status === "waiting" || styled || hasUnreadCoachUpdate || reviewNeedsAttention;

  return (
    <button
      type="button"
      aria-label={[
        flagship ? "Rooting phrase active" : ARIA[status],
        hasCoach ? COACH_LABEL : null,
        hasUnreadCoachUpdate ? "New coach update" : null,
        reviewStatus === "pending_coach_review" ? "Pending coach review" : null,
        reviewStatus === "coach_reviewed" ? "Coach reviewed" : null,
        reviewStatus === "not_confirmed" ? "Coach did not confirm this moment" : null,
        styled ? STYLE_LABEL : null,
      ]
        .filter(Boolean)
        .join(" — ")}
      data-status={attention ? "attention" : flagship ? "filled" : "outline"}
      data-coach={hasCoach ? "true" : undefined}
      data-coach-unread={hasUnreadCoachUpdate ? "true" : undefined}
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
      {reviewStatus === "pending_coach_review" ? (
        <span className="pr-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
          Pending
        </span>
      ) : null}
      {hasCoach ? (
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${hasUnreadCoachUpdate ? "bg-primary motion-safe:animate-pulse" : "bg-muted-foreground"}`}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
