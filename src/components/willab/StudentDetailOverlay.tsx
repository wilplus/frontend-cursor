"use client";

import { useEffect, useState } from "react";
import { Loader2, X, FileAudio } from "lucide-react";
import {
  fetchCoachStudentDetail,
  type CoachStudentDetail,
} from "@/services/api/coachStudentDetail";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  StudentDetailOverlay — the coach's per-student drill-down (E-1b / S6)       */
/*                                                                            */
/*  Pseudonymized: pseudonym + domain + the user's free-text goal + their        */
/*  session history. NEVER the real name or email (§B.4). Tapping a session       */
/*  opens it for review (reuses the existing CoachReviewOverlay via onOpenReview, */
/*  threaded up to the Lounge). Soft-fails to a not-found note if the endpoint    */
/*  (S6) isn't live yet.                                                         */
/* -------------------------------------------------------------------------- */

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

function stateLabel(state: string): string {
  if (state === "review_pending") return "Awaiting review";
  if (state === "readout_ready") return "Sent";
  if (state === "done") return "Insights sent";
  return state ? state.replace(/_/g, " ") : "";
}

const FEELING_EMOJI: Record<string, string> = {
  nervous: "😬",
  excited: "🔥",
  calm: "😌",
  unsure: "🤔",
};

export default function StudentDetailOverlay({
  userId,
  fallbackPseudonym,
  onClose,
  onOpenReview,
}: {
  userId: string;
  /** Shown in the header until the detail loads (carried from the roster row). */
  fallbackPseudonym?: string;
  onClose: () => void;
  onOpenReview: (sessionId: string) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [detail, setDetail] = useState<CoachStudentDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchCoachStudentDetail(userId).then((d) => {
      if (!active) return;
      setDetail(d);
      setStatus(d ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="truncate text-[15px] font-semibold text-foreground">
          {detail?.pseudonym || fallbackPseudonym || "Student"}
          {detail?.domain ? (
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              · {prettifyDomain(detail.domain)}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close student"
          className="ml-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : status === "error" || !detail ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            Couldn&apos;t load this student just now. Try again in a moment.
          </p>
        ) : (
          <>
            {detail.goal ? (
              <section>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Goal
                </p>
                <p className="text-[15px] leading-relaxed text-foreground">
                  {detail.goal}
                </p>
                {detail.previousGoal ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Previously: {detail.previousGoal}
                    {detail.goalChangedAt
                      ? ` · changed ${dateLabel(detail.goalChangedAt)}`
                      : null}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section>
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Sessions
              </p>
              {detail.sessions.length === 0 ? (
                <p className="text-[15px] text-muted-foreground">
                  No sessions yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.sessions.map((s) => (
                    <li key={s.sessionId}>
                      <button
                        type="button"
                        onClick={() => onOpenReview(s.sessionId)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                      >
                        <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-foreground">
                            {s.topic || "Recording"}
                          </span>
                          {dateLabel(s.createdAt) ? (
                            <span className="block text-[12px] text-muted-foreground">
                              {dateLabel(s.createdAt)}
                            </span>
                          ) : null}
                        </span>
                        {s.feeling ? (
                          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {FEELING_EMOJI[s.feeling]} {s.feeling}
                          </span>
                        ) : null}
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {stateLabel(s.state)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
