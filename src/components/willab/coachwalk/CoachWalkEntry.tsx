"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's door to the walk (founder 2026-09-30, A7; build plan P2-8).    */
/*                                                                            */
/*  One bubble in the thread, "N speakers waiting", and one button under it,   */
/*  "Your queue". Both open the Queue; a moment opens the walk over its take.  */
/*  Mounted by the Lounge only when the walk switch is on and the user is a    */
/*  coach; the per-student bubbles and the roster stay for everyone else       */
/*  until group 4 lifts the switch.                                            */
/*                                                                            */
/*  THE REDRAWN PANEL (founder lock 2026-10-06; build plan P1): with the       */
/*  coach panel's switch on (coachPanelSwitch.ts) this door is CoachPanelDoor  */
/*  instead; off, it is exactly today's. The choice is made here, so the      */
/*  Lounge mounts one door as before and gains no branch.                     */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import CoachQueueOverlay from "./CoachQueueOverlay";
import CoachStudentsOverlay from "./CoachStudentsOverlay";
import CoachWalkOverlay from "./CoachWalkOverlay";
import { COACH_STUDENTS_ENABLED } from "@/lib/willab/coachStudents";
import { useMomentsQueue } from "./useMomentsQueue";
import { CoachAuditSheet, CoachBlockPickSheet } from "./CoachBlindSheet";
import { fetchBlockPicks, fetchErrorAudit, type BlockPickQueue, type ErrorAuditQueue } from "@/services/api/coachPanel";
import { fetchTakeBubbles, type TakeBubble } from "@/services/api/coachBubbles";
import { speakersWaiting, type QueueSpeaker, type QueueTake } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";
import { coachPanelOn } from "@/lib/willab/coachPanelSwitch";
import { CoachWalkBubble } from "./CoachWalkBubble";
import CoachPanelDoor from "../coachpanel/CoachPanelDoor";

export { CoachWalkBubble };

type Open = { speaker: QueueSpeaker; take: QueueTake; snippetId: string };

/** Phase 0c (A2): one bubble per Take this coach has not walked yet. */
export function CoachTakeBubble({ bubble, onOpen }: { bubble: TakeBubble; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="coach-take-bubble"
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/80"
    >
      <span className="text-[14px] font-semibold text-foreground">
        {COPY.bubbleTake(bubble.name ?? bubble.pseudonym, bubble.takeIndex)}
      </span>
      <span className="mt-1 block text-[12px] text-muted-foreground">
        {bubble.waitingForText ? COPY.bubbleTakeWaiting : COPY.bubbleTakeOpen}
      </span>
    </button>
  );
}

type EntryProps = {
  /** The thread bubble; off where the host draws its own. */
  bubble?: boolean;
};

/** The coach panel's switch, read once on the client: the server and the
 *  first paint draw today's door, so hydration matches. */
function usePanelSwitch(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(coachPanelOn()), []);
  return on;
}

export default function CoachWalkEntry(props: EntryProps) {
  const panel = usePanelSwitch();
  return panel ? <CoachPanelDoor bubble={props.bubble} /> : <TodaysDoor {...props} />;
}

function TodaysDoor({ bubble = true }: EntryProps) {
  const queue = useMomentsQueue(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [open, setOpen] = useState<Open | null>(null);
  const [audit, setAudit] = useState<ErrorAuditQueue | null>(null);
  const [picks, setPicks] = useState<BlockPickQueue | null>(null);
  const [blindOpen, setBlindOpen] = useState<"audit" | "picks" | null>(null);
  const [bubbles, setBubbles] = useState<TakeBubble[] | null>(null);
  const waiting = speakersWaiting(queue.speakers);

  // Phase 0c: the Take bubbles follow the queue's refreshes; null while the
  // backend is dark, and the thread then draws exactly as before.
  useEffect(() => {
    let cancelled = false;
    void fetchTakeBubbles().then((next) => { if (!cancelled) setBubbles(next); });
    return () => { cancelled = true; };
  }, [queue.speakers]);

  function openBubble(b: TakeBubble): void {
    for (const speaker of queue.speakers) {
      const take = speaker.takes.find((t) => t.sessionId === b.sessionId);
      const first = take?.moments[0]?.snippetId ?? b.firstSnippetId;
      if (take && first) { setOpen({ speaker, take, snippetId: first }); return; }
    }
    setQueueOpen(true);
  }

  // The blind lines (6a, 8) ride the queue's opening; both read null while
  // the backend is dark, and the queue then draws exactly as before.
  useEffect(() => {
    if (!queueOpen) return;
    let cancelled = false;
    void fetchErrorAudit().then((next) => { if (!cancelled) setAudit(next); });
    void fetchBlockPicks().then((next) => { if (!cancelled) setPicks(next); });
    return () => { cancelled = true; };
  }, [queueOpen]);

  return (
    <>
      {bubble ? <CoachWalkBubble waiting={waiting} onOpen={() => setQueueOpen(true)} /> : null}
      {bubble && bubbles ? bubbles.map((b) => (
        <CoachTakeBubble key={b.sessionId} bubble={b} onOpen={() => openBubble(b)} />
      )) : null}
      {/* Phase 0b (founder 2026-10-01): the Students button takes the place
          the queue button had; the queue stays as the bubble above. Off, the
          queue button stands where it always did. */}
      {COACH_STUDENTS_ENABLED ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setStudentsOpen(true)}
          data-testid="coach-students-button"
          className="h-12 w-full gap-2 rounded-full"
        >
          <Users className="h-4 w-4" />
          {COPY.buttonStudents}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setQueueOpen(true)}
          className="h-12 w-full gap-2 rounded-full"
        >
          <Users className="h-4 w-4" />
          {COPY.buttonQueue}
        </Button>
      )}
      {studentsOpen ? (
        <CoachStudentsOverlay
          onClose={() => setStudentsOpen(false)}
          onOpenTake={(speaker, take) => {
            const first = take.moments[0]?.snippetId;
            if (first) setOpen({ speaker, take, snippetId: first });
          }}
        />
      ) : null}
      {queueOpen ? (
        <CoachQueueOverlay
          speakers={queue.speakers}
          loading={queue.loading}
          onClose={() => setQueueOpen(false)}
          onOpenMoment={(speaker, take, snippetId) => setOpen({ speaker, take, snippetId })}
          blind={{ audit, picks, onOpenAudit: () => setBlindOpen("audit"), onOpenPicks: () => setBlindOpen("picks") }}
        />
      ) : null}
      {blindOpen === "audit" && audit ? (
        <CoachAuditSheet queue={audit} onClose={() => setBlindOpen(null)}
          onDone={() => { setBlindOpen(null); setAudit(null); }} />
      ) : null}
      {blindOpen === "picks" && picks ? (
        <CoachBlockPickSheet queue={picks} onClose={() => setBlindOpen(null)}
          onDone={() => { setBlindOpen(null); setPicks(null); }} />
      ) : null}
      {open ? (
        <CoachWalkOverlay
          key={`${open.take.sessionId}:${open.snippetId}`}
          speakers={queue.speakers}
          speaker={open.speaker}
          take={open.take}
          startSnippetId={open.snippetId}
          onClose={() => { setOpen(null); queue.refresh(); }}
          onChanged={queue.refresh}
          onOpenMoment={(speaker, take, snippetId) => setOpen({ speaker, take, snippetId })}
        />
      ) : null}
    </>
  );
}
