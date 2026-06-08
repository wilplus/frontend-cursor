"use client";

import { CheckCircle2, Clock } from "lucide-react";
import type { ReviewQueueRow } from "@/services/api/reviewQueue";

/* -------------------------------------------------------------------------- */
/*  CoachReviewBubble — a review-queue row, rendered as an inbound bubble      */
/*  in the coach's Lounge thread (§F.1).                                       */
/*                                                                            */
/*  Three lifecycle states (B.7):                                              */
/*    pending     — fresh session, no coach action. Orange dot, "Review…"       */
/*    in_progress — coach has saved ≥1 per-snippet draft. Muted "In progress"   */
/*    done        — coach has published. Green ✓                              */
/*                                                                            */
/*  Identity is pseudonymous (§S.4): pseudonym + domain only. NEVER real name  */
/*  or email — that's the C1 violation §14 red-line 6 forbids. The bubble has   */
/*  no avatar of the user; the pseudonym IS the identifier.                    */
/*                                                                            */
/*  Tap action: `onOpen(sessionId)` opens the in-Lounge CoachReviewOverlay      */
/*  (§F.2) via state — pure, no navigation, the chat thread stays mounted        */
/*  beneath. The old standalone /coach/willab/<sid> route is RETIRED (N1): it     */
/*  bounced the coach to /login on back-nav (the route-vs-overlay violation),     */
/*  and now just redirects into the Lounge.                                      */
/* -------------------------------------------------------------------------- */

export default function CoachReviewBubble({
  row,
  onOpen,
}: {
  row: ReviewQueueRow;
  onOpen: (sessionId: string) => void;
}) {
  const isDone = row.state === "done";
  const stateLabel =
    row.state === "done"
      ? "Done"
      : row.state === "in_progress"
      ? "In progress"
      : `${row.nSnippets || ""} snippet${row.nSnippets === 1 ? "" : "s"} to label`
          .trim();

  return (
    <button
      type="button"
      onClick={() => onOpen(row.sessionId)}
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/80"
      aria-label={`Open review for ${row.pseudonym || "unnamed session"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-foreground">
          {row.pseudonym || "—"}
        </span>
        {row.domain ? (
          <span className="text-[12px] text-muted-foreground">
            · {prettifyDomain(row.domain)}
          </span>
        ) : null}
      </div>
      {row.topic ? (
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          “{row.topic}”
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5">
        {isDone ? (
          <CheckCircle2
            className="h-3.5 w-3.5 text-success"
            aria-hidden
          />
        ) : row.state === "pending" ? (
          <span
            className="inline-block h-2 w-2 rounded-full bg-primary"
            aria-hidden
          />
        ) : (
          <Clock
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
        )}
        <span
          className={`text-[12px] ${
            isDone ? "text-success" : "text-muted-foreground"
          }`}
        >
          {stateLabel}
        </span>
      </div>
    </button>
  );
}

/** Map enum keys to human labels — matches the §2 DomainChips spec. */
function prettifyDomain(domain: string): string {
  switch (domain) {
    case "public_speaking":
      return "Public speaking";
    case "sales":
      return "Sales";
    case "executive_presence":
      return "Executive presence";
    case "customer_service":
      return "Customer service";
    case "interview_prep":
      return "Interview prep";
    default:
      return domain;
  }
}
