"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's way in, a row in the list of chats (backend N521).             */
/*                                                                            */
/*  The panel stays mounted in the Lounge (CoachPanelDoor), under the list;    */
/*  the row lives in the list. This joins them: the door publishes how many    */
/*  speakers wait (null until the queue is read or remembered, so the row     */
/*  never says "Nobody" before it knows), and the row asks the door to open    */
/*  Your queue.                                                                */
/* -------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

/** The row's tap: the door opens Your queue. */
export const OPEN_QUEUE_EVENT = "willab:coach-open-queue";

let waiting: number | null = null;
const listeners = new Set<() => void>();

/** The door's count of speakers waiting, as its queue has it. */
export function publishWaiting(next: number | null): void {
  if (next === waiting) return;
  waiting = next;
  listeners.forEach((listen) => listen());
}

function subscribe(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** How many speakers wait; null until the door knows. */
export function useCoachWaiting(): number | null {
  return useSyncExternalStore(subscribe, () => waiting, () => null);
}

export function openCoachQueue(): void {
  window.dispatchEvent(new Event(OPEN_QUEUE_EVENT));
}
