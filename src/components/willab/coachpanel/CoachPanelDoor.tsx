"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's Lounge door, redrawn (founder lock 2026-10-06, flow step 1;    */
/*  build plan P1). Mounted by CoachWalkEntry, the Lounge's one door for a     */
/*  coach; permanent since 2026-10-11 (founder, "make them permanent").       */
/*                                                                            */
/*    the bubble        "N speakers waiting · Open your queue" opens the new   */
/*                      queue (CoachPanel)                                    */
/*    Speakers          Your speakers: EVERY speaker this coach may hear, an  */
/*                      orange dot on those waiting (D-CP-12, from            */
/*                      GET /v2/coach/speakers); a speaker opens on their     */
/*                      goal and their Takes                                  */
/*    Training corpus   the corpus inside the panel (D-CP-20): the imports,   */
/*                      Import audio, the set-up, the blind judging          */
/*                                                                            */
/* -------------------------------------------------------------------------- */

import { useEffect, useReducer, useRef } from "react";
import { AudioLines, Users } from "lucide-react";
import CoachPanel from "./CoachPanel";
import CoachWalkBubble from "../coachwalk/CoachWalkBubble";
import { useMomentsQueue } from "../coachwalk/useMomentsQueue";
import { PANEL_START, panelReducer, type PanelState } from "@/lib/willab/coachPanel";
import { speakersWaiting } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

const PINNED =
  "walk-press flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-border bg-background text-[15px] font-semibold text-foreground";

/** The two buttons pinned above the message box, with icons. */
export function CoachPanelPinned({ onSpeakers, onCorpus }: { onSpeakers: () => void; onCorpus: () => void }) {
  return (
    <div data-testid="coach-panel-pinned" className="flex gap-2.5">
      <button type="button" onClick={onSpeakers} data-testid="coach-panel-speakers-button" className={PINNED}>
        <Users aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        {COPY.speakers}
      </button>
      <button type="button" onClick={onCorpus} data-testid="coach-panel-corpus-button" className={PINNED}>
        <AudioLines aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        {COPY.trainingCorpus}
      </button>
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
  const waiting = speakersWaiting(queue.speakers);

  // Back in the Lounge after answering: the queue and the bubble read fresh.
  const wasOpen = useRef(false);
  const refresh = queue.refresh;
  useEffect(() => {
    const open = state.screen.key !== "lounge";
    if (wasOpen.current && !open) refresh();
    wasOpen.current = open;
  }, [state.screen.key, refresh]);

  return (
    <>
      {bubble ? <CoachWalkBubble waiting={waiting} onOpen={() => dispatch({ type: "open" })} /> : null}
      <CoachPanelPinned onSpeakers={() => dispatch({ type: "speakers" })} onCorpus={() => dispatch({ type: "corpus" })} />
      <CoachPanel state={state} dispatch={dispatch} speakers={queue.speakers} loading={queue.loading} />
    </>
  );
}
