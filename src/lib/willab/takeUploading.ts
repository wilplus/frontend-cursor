"use client";

import { useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/*  A Take still going up after its screens closed (founder 2026-11-10: "if I  */
/*  close the processing earlier there is no indication that it is            */
/*  processing").                                                             */
/*                                                                            */
/*  The ✕ on the processing screen closes the Lab while the upload goes on.   */
/*  Until the server answers there is no session, so no processing marker,   */
/*  and the chat had nothing to show. The Lab says here that a Take is still */
/*  going up; the chat shows "Processing your recording" for it at once, and  */
/*  the marker takes over when the answer lands (`landUnwatched`).            */
/*                                                                            */
/*  This tab only: the upload lives in this tab, and so does the chat.        */
/* -------------------------------------------------------------------------- */

let going = 0;
const listeners = new Set<() => void>();

function changed(): void {
  listeners.forEach((listener) => listener());
}

/** A Take is going up with no screen watching it. Call the returned function
 *  once its answer has come, whatever it was; a second call does nothing. */
export function takeUploadingUnwatched(): () => void {
  going += 1;
  changed();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    going -= 1;
    changed();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a Take is still going up after its screens closed. */
export function useTakeUploadingUnwatched(): boolean {
  return useSyncExternalStore(subscribe, () => going > 0, () => false);
}
