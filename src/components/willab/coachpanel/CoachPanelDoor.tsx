"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's door (founder lock 2026-10-06; moved by backend N521,          */
/*  5 November 2026). Mounted by CoachWalkEntry in the Lounge, with nothing   */
/*  of its own on screen: the way in is a row in the list of chats            */
/*  (CoachChatRow), and the bottom of Will's chat is only its bar.            */
/*                                                                            */
/*    the row           its tap opens the queue (CoachPanel); the door        */
/*                      publishes how many speakers wait for its line         */
/*                      (lib/willab/coachDoor)                                */
/*    Speakers          the last card in the queue: EVERY speaker this coach  */
/*                      may hear, an orange dot on those waiting (C5)         */
/*    (the training corpus is the founder's, in the admin menu, N416, N511)  */
/*    Open speaker      a goal card in the Lounge opens that speaker          */
/*                      (WIL-74, founder 2026-10-19; lib/willab/openSpeaker)  */
/*                                                                            */
/* -------------------------------------------------------------------------- */

import { useEffect, useReducer, useRef } from "react";
import CoachPanel from "./CoachPanel";
import { useMomentsQueue } from "../coachwalk/useMomentsQueue";
import { PANEL_START, panelReducer, type PanelState } from "@/lib/willab/coachPanel";
import { OPEN_SPEAKER_EVENT, type OpenSpeakerDetail } from "@/lib/willab/openSpeaker";
import { fetchCoachSpeakers, queueSpeakerFor } from "@/services/api/coachSpeakers";
import { OPEN_QUEUE_EVENT, publishWaiting } from "@/lib/willab/coachDoor";

export default function CoachPanelDoor({
  initial = PANEL_START,
}: {
  /** Where the panel starts (the dev harness's still screens). */
  initial?: PanelState;
}) {
  const queue = useMomentsQueue(true);
  const [state, dispatch] = useReducer(panelReducer, initial);
  // null until the queue is read once (or remembered on this device): the
  // row never says "Nobody" before it knows (founder 2026-10-18).
  const waiting = queue.waiting;
  useEffect(() => publishWaiting(waiting), [waiting]);
  useEffect(() => () => publishWaiting(null), []);

  // The row in the list of chats opens Your queue (N521).
  useEffect(() => {
    const onOpen = () => dispatch({ type: "open" });
    window.addEventListener(OPEN_QUEUE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_QUEUE_EVENT, onOpen);
  }, []);

  // Back from the panel after answering: the queue and the row read fresh.
  const wasOpen = useRef(false);
  const refresh = queue.refresh;
  useEffect(() => {
    const open = state.screen.key !== "lounge";
    if (wasOpen.current && !open) refresh();
    wasOpen.current = open;
  }, [state.screen.key, refresh]);

  // A goal card's "Open speaker": the speaker this coach may hear, by their
  // pseudonym; Your speakers when they are not in the list.
  const queueSpeakers = queue.speakers;
  useEffect(() => {
    const onOpen = (event: Event) => {
      const { pseudonym } = (event as CustomEvent<OpenSpeakerDetail>).detail ?? {};
      if (!pseudonym) return;
      void fetchCoachSpeakers().then((all) => {
        const found = all?.find((s) => s.pseudonym === pseudonym);
        dispatch(found ? { type: "speaker", speaker: queueSpeakerFor(found, queueSpeakers) } : { type: "speakers" });
      });
    };
    window.addEventListener(OPEN_SPEAKER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SPEAKER_EVENT, onOpen);
  }, [queueSpeakers]);

  return (
    <CoachPanel state={state} dispatch={dispatch} speakers={queue.speakers} loading={queue.loading}
      refresh={queue.refresh} />
  );
}
