"use client";

import { CheckCircle2, Clock, FileAudio } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import type {
  ReviewStudentGroup,
  ReviewQueueRow,
} from "@/services/api/reviewQueue";

/* -------------------------------------------------------------------------- */
/*  ReviewGroupOverlay — a student's recordings list, built from queue rows    */
/*                                                                            */
/*  FP-4 fallback for the pre-BE-4 window (queue rows carry no user_id, so the  */
/*  richer StudentDetailOverlay can't fetch): the collapsed per-student bubble  */
/*  opens THIS list instead, assembled purely from the grouped queue rows we    */
/*  already hold. Each row opens the same CoachReviewOverlay (onOpenReview),    */
/*  so the /chat?review=<id> deep-link and the review flow are unchanged.       */
/*  Once BE-4 ships user_id, groups route to StudentDetailOverlay and this      */
/*  overlay is only hit for identity-less rows.                                 */
/* -------------------------------------------------------------------------- */

export default function ReviewGroupOverlay({
  group,
  onClose,
  onOpenReview,
}: {
  group: ReviewStudentGroup;
  onClose: () => void;
  onOpenReview: (sessionId: string) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="truncate text-[15px] font-semibold text-foreground">
          {group.pseudonym || "Student"}
          {group.domain ? (
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              · {prettifyDomain(group.domain)}
            </span>
          ) : null}
        </span>
        <OverlayCloseButton
          onClick={onClose}
          ariaLabel="Close recordings"
          className="ml-3"
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <section>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Recordings
          </p>
          <ul className="flex flex-col gap-2">
            {group.rows.map((r) => (
              <li key={r.sessionId}>
                <button
                  type="button"
                  onClick={() => onOpenReview(r.sessionId)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                >
                  <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-foreground">
                      {r.topic || "Recording"}
                    </span>
                    {dateLabel(r.sentAt) ? (
                      <span className="block text-[12px] text-muted-foreground">
                        {dateLabel(r.sentAt)}
                      </span>
                    ) : null}
                  </span>
                  <StateChip row={r} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** The 3-state lifecycle chip, per row (pending / in-progress / done). */
function StateChip({ row }: { row: ReviewQueueRow }) {
  if (row.state === "done") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Delivered
      </span>
    );
  }
  if (row.state === "in_progress") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Clock className="h-3 w-3" aria-hidden />
        In progress
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      To review
    </span>
  );
}

function dateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
