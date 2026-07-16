"use client";

import { CheckCircle2, Clock } from "lucide-react";
import type { ReviewStudentGroup } from "@/services/api/reviewQueue";

/* -------------------------------------------------------------------------- */
/*  CoachReviewGroupBubble — ONE bubble per student (FP-4)                     */
/*                                                                            */
/*  Replaces the one-bubble-per-session queue: a student who sent three takes  */
/*  now shows a single "{pseudonym} — 3 recordings to review" bubble that       */
/*  opens their recordings list. Keeps the 3-state lifecycle at the group      */
/*  level (pending dot / in-progress clock / done ✓) and never assumes a fixed  */
/*  session count (BE-2 hides re-reads, so counts vary).                       */
/*                                                                            */
/*  Identity is pseudonymous (§S.4): pseudonym + domain only, NEVER real name  */
/*  or email.                                                                  */
/* -------------------------------------------------------------------------- */

export default function CoachReviewGroupBubble({
  group,
  onOpen,
}: {
  group: ReviewStudentGroup;
  onOpen: (group: ReviewStudentGroup) => void;
}) {
  const isDone = group.state === "done";
  const n = group.toReviewCount;
  const stateLabel = isDone
    ? "All reviewed"
    : group.state === "in_progress"
    ? `${n} in progress`
    : `${n} recording${n === 1 ? "" : "s"} to review`;

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/80"
      aria-label={`Open recordings for ${group.pseudonym || "unnamed student"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-foreground">
          {group.pseudonym || "—"}
        </span>
        {group.domain ? (
          <span className="text-[12px] text-muted-foreground">
            · {prettifyDomain(group.domain)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : group.state === "pending" ? (
          <span
            className="inline-block h-2 w-2 rounded-full bg-primary"
            aria-hidden
          />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
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
