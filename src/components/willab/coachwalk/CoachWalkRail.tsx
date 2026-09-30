"use client";

/* -------------------------------------------------------------------------- */
/*  The desktop rail (founder 2026-09-30, B10; build plan P2-14).               */
/*                                                                            */
/*  From 1024px the Queue sits on the left while the sheet stays centred in   */
/*  what is left, so the coach sees where they are without leaving the        */
/*  moment. The rail never shows more than the Queue does: speakers, takes,   */
/*  and each moment's state as a word. Never the kind, the passage or an      */
/*  answer before that moment's rating is saved (BLIND COACH); never a count  */
/*  of quality (AC-9). It is navigation, not a second action.                 */
/* -------------------------------------------------------------------------- */

import { stateWord, type QueueMoment, type QueueSpeaker, type QueueTake } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export default function CoachWalkRail({
  speakers,
  currentTake,
  currentMoments,
  currentSnippetId,
  onOpenMoment,
}: {
  speakers: QueueSpeaker[];
  currentTake: QueueTake;
  /** The open take's moments with the walk's own local states. */
  currentMoments: QueueMoment[];
  currentSnippetId: string | null;
  onOpenMoment: (speaker: QueueSpeaker, take: QueueTake, snippetId: string) => void;
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-[51] hidden w-[260px] flex-col gap-3 overflow-y-auto border-r border-border bg-muted/40 px-4 py-5 lg:flex"
      data-testid="coach-walk-rail"
      aria-label={COPY.queueTitle}
    >
      <h2 className="text-[15px] font-bold text-foreground">{COPY.queueTitle}</h2>
      {speakers.map((speaker, i) => (
        <section key={`${speaker.pseudonym}:${i}`} className="flex flex-col gap-1.5">
          {speaker.takes.map((take) => {
            const open = take.sessionId === currentTake.sessionId;
            const moments = open ? currentMoments : take.moments;
            return (
              <div key={take.sessionId} className={`rounded-lg border px-2.5 py-2 ${
                open ? "border-foreground bg-background" : "border-border bg-background/60"}`}>
                <button type="button" className="flex w-full flex-col text-left"
                  onClick={() => moments[0] && onOpenMoment(speaker, take, moments[0].snippetId)}>
                  <span className="text-[13px] font-semibold text-foreground">{speaker.pseudonym}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {COPY.queueTake(take.takeIndex, take.moments.length)}
                  </span>
                </button>
                {open ? (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {moments.map((m, index) => {
                      const current = m.snippetId === currentSnippetId;
                      return (
                        <li key={m.snippetId}>
                          <button
                            type="button"
                            aria-current={current ? "true" : undefined}
                            onClick={() => onOpenMoment(speaker, take, m.snippetId)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] ${
                              current ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted"}`}
                          >
                            <span aria-hidden className={`block h-2 w-2 rounded-full border ${
                              m.state === "judge_it" ? "border-foreground" : "border-foreground bg-foreground"} ${
                              current ? "border-primary" : ""}`} />
                            {COPY.queueMoment(index + 1)} · {stateWord(m.state).toLowerCase()}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </aside>
  );
}
