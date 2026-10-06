"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's Lounge door, redrawn (founder lock 2026-10-06, flow step 1;    */
/*  build plan P1). Mounted by CoachWalkEntry only while the coach panel's     */
/*  switch is on; off, today's door stands exactly as it was.                  */
/*                                                                            */
/*    the bubble        "N speakers waiting · Open your queue" opens the new   */
/*                      queue (CoachPanel)                                    */
/*    Speakers          P1: opens the same queue, whose list is "Your         */
/*                      speakers". The list of EVERY speaker, an orange dot   */
/*                      on those waiting, is P5 (it needs the backend's       */
/*                      students read)                                        */
/*    Training corpus   P1: today's corpus page (/coach/corpus)               */
/*                                                                            */
/*  THE HAND-OVER (P1 only). What happened's Next gives the moment to today's */
/*  walk (CoachWalkOverlay) at that moment, already rated, so it opens on its */
/*  read screen with Answer and Nothing to add: the coach finishes the moment */
/*  there. When that moment is answered the old walk hands back (onHandBack) */
/*  and the panel opens the next open moment of the Take, or the speaker's   */
/*  Takes when none is left. ✕ in the old walk returns to the Lounge.         */
/* -------------------------------------------------------------------------- */

import { useReducer, useState } from "react";
import Link from "next/link";
import { AudioLines, Users } from "lucide-react";
import CoachPanel from "./CoachPanel";
import CoachWalkBubble from "../coachwalk/CoachWalkBubble";
import CoachWalkOverlay from "../coachwalk/CoachWalkOverlay";
import { useMomentsQueue } from "../coachwalk/useMomentsQueue";
import WalkToast from "../walk/WalkToast";
import {
  PANEL_START, momentOf, panelReducer, takeWithRatings, type MomentScreen, type PanelState,
} from "@/lib/willab/coachPanel";
import { speakersWaiting, type QueueMoment, type QueueSpeaker, type QueueTake } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

type Handed = { speaker: QueueSpeaker; take: QueueTake; snippetId: string; index: number };

const PINNED =
  "walk-press flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-border bg-background text-[15px] font-semibold text-foreground";

/** The two buttons pinned above the message box, with icons. */
export function CoachPanelPinned({ onSpeakers }: { onSpeakers: () => void }) {
  return (
    <div data-testid="coach-panel-pinned" className="flex gap-2.5">
      <button type="button" onClick={onSpeakers} data-testid="coach-panel-speakers-button" className={PINNED}>
        <Users aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        {COPY.speakers}
      </button>
      <Link href="/coach/corpus" data-testid="coach-panel-corpus-button" className={PINNED}>
        <AudioLines aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        {COPY.trainingCorpus}
      </Link>
    </div>
  );
}

export default function CoachPanelDoor({
  bubble = true,
  initial = PANEL_START,
}: {
  /** The thread bubble; off where the host draws its own. */
  bubble?: boolean;
  /** Where the panel starts (the dev harness's still screens). */
  initial?: PanelState;
}) {
  const queue = useMomentsQueue(true);
  const [state, dispatch] = useReducer(panelReducer, initial);
  const [handed, setHanded] = useState<Handed | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const waiting = speakersWaiting(queue.speakers);

  function handOver(screen: MomentScreen): void {
    const snippetId = momentOf(screen)?.snippetId;
    if (!snippetId) return;
    setHanded({ speaker: screen.speaker, take: takeWithRatings(screen.take, state.rated), snippetId, index: screen.index });
    dispatch({ type: "close" });
  }

  function handBack(moments: QueueMoment[], said: string | null): void {
    if (!handed) return;
    setHanded(null);
    queue.refresh();
    dispatch({ type: "resume", speaker: handed.speaker, take: { ...handed.take, moments }, index: handed.index });
    if (said) setToast((t) => ({ id: (t?.id ?? 0) + 1, text: said }));
  }

  return (
    <>
      {bubble ? <CoachWalkBubble waiting={waiting} onOpen={() => dispatch({ type: "open" })} /> : null}
      <CoachPanelPinned onSpeakers={() => dispatch({ type: "open" })} />
      <CoachPanel state={state} dispatch={dispatch} speakers={queue.speakers} loading={queue.loading}
        onHandover={handOver} />
      {handed ? (
        <CoachWalkOverlay
          key={`${handed.take.sessionId}:${handed.snippetId}`}
          speakers={queue.speakers}
          speaker={handed.speaker}
          take={handed.take}
          startSnippetId={handed.snippetId}
          onClose={() => { setHanded(null); queue.refresh(); }}
          onChanged={queue.refresh}
          onOpenMoment={(speaker, take, snippetId) => setHanded({
            speaker, take, snippetId, index: Math.max(0, take.moments.findIndex((m) => m.snippetId === snippetId)),
          })}
          onHandBack={handBack}
        />
      ) : null}
      {toast ? <WalkToast key={toast.id} message={toast.text} onDone={() => setToast(null)} /> : null}
    </>
  );
}
