"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  fetchCoachStudents,
  type CoachStudent,
} from "@/services/api/coachStudents";
import { useBackDismiss } from "./useBackDismiss";

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
}: {
  onClose: () => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [students, setStudents] = useState<CoachStudent[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCoachStudents().then((s) => {
      if (active) setStudents(s);
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close roster"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {students === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">No students yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((s) => {
              const meta = [prettifyDomain(s.domain), lastActiveLabel(s.lastActive)]
                .filter((v) => v && v.length > 0)
                .join(" · ");
              return (
                <li
                  key={s.pseudonym}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {s.pseudonym}
                    </p>
                    {meta ? (
                      <p className="truncate text-[12px] text-muted-foreground">
                        {meta}
                      </p>
                    ) : null}
                  </div>
                  {s.sessionCount != null ? (
                    <span
                      className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground"
                      title="Sessions sent for review"
                    >
                      {s.sessionCount} sent
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
