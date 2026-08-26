"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Crown } from "lucide-react";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
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

export default function StudentDetailOverlay({
  userId,
  fallbackPseudonym,
  onClose,
  onOpenReview,
  onOpenArcIdeal,
  onOpenStarVerdicts,
}: {
  userId: string;
  /** Shown in the header until the detail loads (carried from the roster row). */
  fallbackPseudonym?: string;
  onClose: () => void;
  onOpenReview: (sessionId: string) => void;
  /** FE-B — open the arc's ideal-text panel from the ready badge. Optional:
   *  without it the badge renders as a non-tappable cue. */
  onOpenArcIdeal?: (arcId: string) => void;
  /** Star Verdict (2026-07-27) — open the arc's star-review overlay. THIS
   *  screen is the entry on purpose (N1): the verdict surface shows the
   *  machine's guesses, so its way in must never be the blind labeling flow
   *  (the review overlay the session rows open) — a separate screen, a
   *  separate navigation entry. Optional: absent, no entry renders. */
  /** sessionIds: the arc's take sessions — the panel's confident-voice
   *  labeling rows aggregate their blind queues (founder 2026-08-10). */
  onOpenStarVerdicts?: (arcId: string, sessionIds: string[]) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [detail, setDetail] = useState<CoachStudentDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  // FE-B — one badge per arc with a ready (persisted, unapproved) draft.
  const idealReadyArcs =
    detail === null
      ? []
      : [
          ...new Set(
            detail.sessions
              .filter((s) => s.arcIdealReady && s.arcId)
              .map((s) => s.arcId as string)
          ),
        ];

  // Star Verdict — one entry per ARC (the review GET is arc-scoped; there is
  // no per-session variant), for every arc the student has, not just the
  // ideal-ready ones: stars fire from take 1. The topic labels the entry when
  // the student has more than one arc — the FIRST (newest, payload order)
  // topic per arc, kept explicitly: `new Map(entries)` is last-write-wins for
  // duplicate keys, which would label an arc with its OLDEST take's topic
  // when the topic was refined between takes (review 2026-07-28).
  const starArcs: { arcId: string; topic: string }[] = [];
  if (detail !== null) {
    const seen = new Set<string>();
    for (const s of detail.sessions) {
      if (!s.arcId || seen.has(s.arcId)) continue;
      seen.add(s.arcId);
      starArcs.push({ arcId: s.arcId, topic: s.topic || "Recording" });
    }
  }

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
        <OverlayCloseButton onClick={onClose} ariaLabel="Close student" className="ml-3" />
      </div>

      <div className="scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <LoadingState placement="surface" />
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

            {/* FE-B — one ideal-ready cue per arc: the coach's signal to open,
                review, approve, and publish the full analysis. Tappable when
                the host threads an opener. */}
            {idealReadyArcs.map((arcId) => (
              <button
                key={arcId}
                type="button"
                onClick={
                  onOpenArcIdeal ? () => onOpenArcIdeal(arcId) : undefined
                }
                disabled={!onOpenArcIdeal}
                className={`flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-left ${
                  onOpenArcIdeal ? "transition-colors hover:border-primary/70" : ""
                }`}
              >
                <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span className="flex-1 text-[14px] font-medium text-foreground">
                  Ideal text ready to review
                </span>
                {onOpenArcIdeal ? (
                  <span className="text-[12px] text-primary">Open</span>
                ) : null}
              </button>
            ))}

            {/* Star Verdict — the arc-level star-review entry, deliberately
                HERE beside the arc's ideal-text cue and the per-take review
                states, and deliberately NOT on the review overlay's wrap-up:
                that overlay is the blind labeling flow, and this surface shows
                the machine's guesses (N1). */}
            {onOpenStarVerdicts
              ? starArcs.map(({ arcId, topic }) => (
                  <button
                    key={`stars-${arcId}`}
                    type="button"
                    onClick={() =>
                      onOpenStarVerdicts(
                        arcId,
                        detail.sessions
                          .filter((s) => s.arcId === arcId)
                          .map((s) => s.sessionId)
                      )
                    }
                    className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50"
                  >
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      fill="none"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                      {/* Founder 2026-08-10: "it should be called feedbacks
                          review" — his word, verbatim-cased. */}
                      Feedbacks review
                      {starArcs.length > 1 ? (
                        <span className="ml-2 font-normal text-muted-foreground">
                          · {topic}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[12px] text-primary">Open</span>
                  </button>
                ))
              : null}

            {/* The SESSIONS history list is DELETED (founder 2026-08-10:
                "delete the sessions list; we just need the feedbacks
                review list") — reviewing lives entirely in the Feedbacks
                review above; a second list was a second way in. */}
          </>
        )}
      </div>
    </div>
  );
}
