"use client";

/* -------------------------------------------------------------------------- */
/*  The training corpus for the founder (backend N416, N511). It left the     */
/*  coach's side while its infrastructure is rebuilt; the founder opens it    */
/*  from the admin menu's Training corpus row (/admin/training-corpus,        */
/*  N511), and ✕ goes to the CEO panel. The screens are                       */
/*  the coach panel's own corpus screens, unchanged (D-CP-20, H in             */
/*  docs/flows/coach-panel.md): the imports, Import audio, the set-up, the     */
/*  blind judging. The panel is started on them and on nothing else, so it     */
/*  reads no queue, no speakers and no blind lines. Every endpoint behind it   */
/*  still checks the caller's role for itself.                                 */
/* -------------------------------------------------------------------------- */

import { useEffect, useReducer, type ReactNode } from "react";
import CoachPanel from "@/components/willab/coachpanel/CoachPanel";
import { PANEL_START, panelReducer } from "@/lib/willab/coachPanel";
import type { QueueSpeaker } from "@/lib/willab/coachWalk";

const NO_SPEAKERS: readonly QueueSpeaker[] = [];

/** The corpus's screens: `panel` is mounted once, and `open` brings up the
 *  imports. With `startOpen` they show at once; `onClose` runs when ✕ shuts
 *  them (the admin menu's page goes to the CEO panel, N511). */
export function useCeoCorpus(
  { startOpen = false, onClose }: { startOpen?: boolean; onClose?: () => void } = {}
): { open: () => void; panel: ReactNode } {
  const [state, dispatch] = useReducer(panelReducer, PANEL_START, (start) =>
    startOpen ? panelReducer(start, { type: "corpus" }) : start
  );
  const closed = state.screen.key === "lounge";
  useEffect(() => {
    if (closed) onClose?.();
  }, [closed, onClose]);
  return {
    open: () => dispatch({ type: "corpus" }),
    panel: <CoachPanel state={state} dispatch={dispatch} speakers={NO_SPEAKERS} loading={false} />,
  };
}

/** /admin/training-corpus (N511): the corpus's screens, open from the start;
 *  ✕ goes to the CEO panel. */
export function CeoCorpusPage({ onClose }: { onClose: () => void }) {
  return <>{useCeoCorpus({ startOpen: true, onClose }).panel}</>;
}
