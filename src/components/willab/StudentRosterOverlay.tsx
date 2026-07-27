"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import {
  fetchCoachStudents,
  type CoachStudent,
} from "@/services/api/coachStudents";
import { useBackDismiss } from "./useBackDismiss";
import StudentDetailOverlay from "./StudentDetailOverlay";

/* -------------------------------------------------------------------------- */
/*  StudentRosterOverlay — the coach's roster (E3)                             */
/*                                                                            */
/*  Opened from a coach-only entry in the Lounge; mounts as an overlay over the  */
/*  hub (never a route). Pseudonymized (§B.4): pseudonym + domain only, never    */
/*  name/email. `sessionCount`, when present, is shown as the coach-throughput   */
/*  signal (who's sending heavily) — the actual "is the coach drowning" read.   */
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

function lastActiveLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `active ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export default function StudentRosterOverlay({
  onClose,
  onOpenReview,
  onOpenArcIdeal,
}: {
  onClose: () => void;
  /** Open a session for review (threaded to the Lounge's openReview). */
  onOpenReview: (sessionId: string) => void;
  /** FE-B — open an arc's ideal-text panel from the ready badge (threaded to
   *  the Lounge, which mounts the coach panel view for that arc). */
  onOpenArcIdeal?: (arcId: string) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [students, setStudents] = useState<CoachStudent[] | null>(null);
  // E-1a (c) — true on a 403 (not on the coach allowlist), distinct from an
  // authorized coach with an empty roster.
  const [forbidden, setForbidden] = useState(false);
  // E-1b — the selected student for the drill-down (null = roster list).
  const [selected, setSelected] = useState<{
    id: string;
    pseudonym: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCoachStudents().then((r) => {
      if (!active) return;
      setStudents(r.students);
      setForbidden(r.forbidden);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Your students
        </span>
        <OverlayCloseButton onClick={onClose} ariaLabel="Close roster" />
      </div>

      <div className="scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {students === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : forbidden ? (
          <p className="text-[15px] text-muted-foreground">
            This account isn&apos;t set up as a coach yet. Ask an admin to add
            you to the coach list.
          </p>
        ) : students.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">No students yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((s) => {
              const meta = [prettifyDomain(s.domain), lastActiveLabel(s.lastActive)]
                .filter((v) => v && v.length > 0)
                .join(" · ");
              return (
                <li key={s.id || s.pseudonym}>
                  <button
                    type="button"
                    onClick={() =>
                      s.id && setSelected({ id: s.id, pseudonym: s.pseudonym })
                    }
                    disabled={!s.id}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors enabled:hover:border-primary/50 disabled:cursor-default"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-foreground">
                        {s.pseudonym}
                      </span>
                      {meta ? (
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {meta}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* FP-1 — ideal text is assembled and waiting on the
                          coach's review for at least one of this student's arcs. */}
                      {s.idealReady ? (
                        <span
                          className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[12px] font-medium text-primary"
                          title="Ideal text ready to review"
                        >
                          <Sparkles className="h-3 w-3" aria-hidden />
                          Ideal ready
                        </span>
                      ) : null}
                      {s.sessionCount != null ? (
                        <span
                          className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground"
                          title="Sessions sent for review"
                        >
                          {s.sessionCount} sent
                        </span>
                      ) : null}
                      {/* Drillable rows get a chevron, so a non-drillable row
                          (BE sent no id) reads as static info, not a dead tap. */}
                      {s.id ? (
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* E-1b — per-student drill-down (z-40, over the roster). Opening a session
          from here routes through the Lounge's openReview; the detail stays
          mounted underneath, so closing the review returns here. */}
      {selected && (
        <StudentDetailOverlay
          onOpenArcIdeal={onOpenArcIdeal}
          userId={selected.id}
          fallbackPseudonym={selected.pseudonym}
          onClose={() => setSelected(null)}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}
