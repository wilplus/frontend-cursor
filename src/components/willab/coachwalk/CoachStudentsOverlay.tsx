"use client";

/* -------------------------------------------------------------------------- */
/*  Students (founder 2026-10-01, Phase 0b): the coach's students, a student's */
/*  profile with their Takes, and from a Take the same coach walk (Judge       */
/*  first; BLIND COACH). Opened from a named profile the walk shows the        */
/*  student's real name. Nothing founder lock B1 to B7 removed comes back:     */
/*  no verdicts, no Ideal Text edit, no Reviewed badge, no publish, no wrap-up, */
/*  no slide mapping, no label chips.                                          */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SheetFrame } from "../ParagraphSheet";
import LoadingState from "../LoadingState";
import {
  fetchCoachStudentProfile, fetchCoachStudents, fetchWalkTake,
} from "@/services/api/coachStudents";
import { studentLabel, type CoachStudent, type CoachStudentProfile } from "@/lib/willab/coachStudents";
import type { QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const ROW = "flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted";

function Profile({
  student, onBack, onOpenTake,
}: {
  student: CoachStudent;
  onBack: () => void;
  onOpenTake: (speaker: QueueSpeaker, take: QueueTake) => void;
}) {
  const [profile, setProfile] = useState<CoachStudentProfile | null | "loading">("loading");
  const [opening, setOpening] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachStudentProfile(student.id).then((p) => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [student.id]);

  async function open(sessionId: string) {
    setOpening(sessionId); setNote(null);
    const result = await fetchWalkTake(sessionId);
    setOpening(null);
    if (!result.ok) { setNote(COPY.studentsOpenFail); return; }
    onOpenTake(result.speaker, result.take);
  }

  const label = profile !== "loading" && profile ? studentLabel(profile) : studentLabel(student);
  return (
    <SheetFrame title={label} onClose={onBack}>
      <div className="flex flex-col gap-5" data-testid="coach-student-profile">
        {profile === "loading" ? <LoadingState placement="surface" /> : null}
        {profile === null ? <p className="text-[14px] text-muted-foreground">{COPY.studentsProfileFail}</p> : null}
        {profile !== "loading" && profile ? (
          <>
            {profile.goal ? (
              <section>
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{COPY.studentsGoal}</span>
                <p className="text-[15px] leading-relaxed text-foreground">{profile.goal}</p>
              </section>
            ) : null}
            <section className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">{COPY.studentsTakes}</span>
              {profile.takes.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">{COPY.studentsNoTakes}</p>
              ) : profile.takes.map((t) => (
                <button key={t.sessionId} type="button" disabled={opening !== null}
                  onClick={() => void open(t.sessionId)} data-testid="coach-student-take" className={ROW}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[14px] font-semibold text-foreground">{COPY.studentsTake(t.takeIndex)}</span>
                    {t.topic ? <span className="truncate text-[12px] text-muted-foreground">{t.topic}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
                    {opening === t.sessionId ? COPY.studentsOpening : COPY.studentsOpenWalk}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              ))}
              {note ? <p role="alert" className="text-[13px] text-destructive">{note}</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </SheetFrame>
  );
}

export default function CoachStudentsOverlay({
  onClose, onOpenTake,
}: {
  onClose: () => void;
  /** Opens the walk over a Take, as the queue does. */
  onOpenTake: (speaker: QueueSpeaker, take: QueueTake) => void;
}) {
  const [students, setStudents] = useState<CoachStudent[] | "loading" | "forbidden">("loading");
  const [selected, setSelected] = useState<CoachStudent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachStudents().then((r) => {
      if (cancelled) return;
      setStudents(r.ok ? r.students : r.code === "FORBIDDEN" ? "forbidden" : []);
    });
    return () => { cancelled = true; };
  }, []);

  if (selected) {
    return <Profile student={selected} onBack={() => setSelected(null)} onOpenTake={onOpenTake} />;
  }
  return (
    <SheetFrame title={COPY.studentsTitle} onClose={onClose}>
      <div className="flex flex-col gap-1.5" data-testid="coach-students">
        {students === "loading" ? <LoadingState placement="surface" /> : null}
        {students === "forbidden" ? <p className="text-[14px] text-muted-foreground">{COPY.studentsNotACoach}</p> : null}
        {Array.isArray(students) && students.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{COPY.studentsEmpty}</p>
        ) : null}
        {Array.isArray(students) ? students.map((s) => (
          <button key={s.id || s.pseudonym} type="button" disabled={!s.id}
            onClick={() => setSelected(s)} data-testid="coach-student" className={ROW}>
            <span className="truncate text-[14px] font-semibold text-foreground">{studentLabel(s)}</span>
            {s.id ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </button>
        )) : null}
      </div>
    </SheetFrame>
  );
}
