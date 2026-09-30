"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's door to the walk (founder 2026-09-30, A7; build plan P2-8).    */
/*                                                                            */
/*  One bubble in the thread, "N speakers waiting", and one button under it,   */
/*  "Your queue". Both open the Queue; a moment opens the walk over its take.  */
/*  Mounted by the Lounge only when the walk switch is on and the user is a    */
/*  coach; the per-student bubbles and the roster stay for everyone else       */
/*  until group 4 lifts the switch.                                            */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import CoachQueueOverlay from "./CoachQueueOverlay";
import CoachWalkOverlay from "./CoachWalkOverlay";
import { useMomentsQueue } from "./useMomentsQueue";
import { speakersWaiting, type QueueSpeaker, type QueueTake } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

type Open = { speaker: QueueSpeaker; take: QueueTake; snippetId: string };

export function CoachWalkBubble({ waiting, onOpen }: { waiting: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="coach-walk-bubble"
      aria-label={COPY.bubbleOpen}
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-muted px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/80"
    >
      <span className="text-[14px] font-semibold text-foreground">{COPY.bubbleWaiting(waiting)}</span>
      <span className="mt-1 block text-[12px] text-muted-foreground">{COPY.bubbleOpen}</span>
    </button>
  );
}

export default function CoachWalkEntry({
  bubble = true,
}: {
  /** The thread bubble; off where the host draws its own. */
  bubble?: boolean;
}) {
  const queue = useMomentsQueue(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const [open, setOpen] = useState<Open | null>(null);
  const waiting = speakersWaiting(queue.speakers);

  return (
    <>
      {bubble ? <CoachWalkBubble waiting={waiting} onOpen={() => setQueueOpen(true)} /> : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => setQueueOpen(true)}
        className="h-12 w-full gap-2 rounded-full"
      >
        <Users className="h-4 w-4" />
        {COPY.buttonQueue}
      </Button>
      {queueOpen ? (
        <CoachQueueOverlay
          speakers={queue.speakers}
          loading={queue.loading}
          onClose={() => setQueueOpen(false)}
          onOpenMoment={(speaker, take, snippetId) => setOpen({ speaker, take, snippetId })}
        />
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
