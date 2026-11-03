"use client";

/* -------------------------------------------------------------------------- */
/*  The training corpus in the CEO panel (backend N407). It left the coach's   */
/*  side (the panel's pinned button and the menu's /coach/corpus row) while    */
/*  its infrastructure is rebuilt; the founder opens it here. The screens are  */
/*  the coach panel's own corpus screens, unchanged (D-CP-20, H in             */
/*  docs/flows/coach-panel.md): the imports, Import audio, the set-up, the     */
/*  blind judging. The panel is started on them and on nothing else, so it     */
/*  reads no queue, no speakers and no blind lines. Every endpoint behind it   */
/*  still checks the caller's role for itself.                                 */
/* -------------------------------------------------------------------------- */

import { useReducer, type ReactNode } from "react";
import CoachPanel from "@/components/willab/coachpanel/CoachPanel";
import { PANEL_START, panelReducer } from "@/lib/willab/coachPanel";
import type { QueueSpeaker } from "@/lib/willab/coachWalk";

const NO_SPEAKERS: readonly QueueSpeaker[] = [];

/** The corpus's screens over the CEO panel: `panel` is mounted once, and
 *  `open` brings up the imports; ✕ goes back to the CEO panel. */
export function useCeoCorpus(): { open: () => void; panel: ReactNode } {
  const [state, dispatch] = useReducer(panelReducer, PANEL_START);
  return {
    open: () => dispatch({ type: "corpus" }),
    panel: <CoachPanel state={state} dispatch={dispatch} speakers={NO_SPEAKERS} loading={false} />,
  };
}
