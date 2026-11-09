"use client";

import { useEffect } from "react";
import type { DualCaptureState } from "@/hooks/useDualCaptureMic";
import type { LabUploadResult } from "@/services/api/labRecording";
import type { WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  THE BROWSER'S OWN "LEAVE PAGE?" (founder 2026-11-09, backend N553 item 1). */
/*                                                                            */
/*  While a Take is recorded, and until the server has it, refreshing or      */
/*  closing the page in a browser asks first, in the browser's own words: no  */
/*  message of ours is set (Never 4), and nothing else asks. Outside that     */
/*  window nothing asks. iPhone Safari and the iPhone app ignore              */
/*  `beforeunload`; item 2 (the Take kept on the device) is for them, a       */
/*  later change. Next.js moves between the app's pages without unloading     */
/*  the document, so an in-app route never shows it.                          */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  A TAP WAITS, THEN GOES (founder 2026-11-09, backend N560 item 3, "Wait,   */
/*  then go"). The same window, app-wide: a tapped push notification, a       */
/*  WillpowerLab link opening the app, or a guest's first Take opening its    */
/*  review once their sign-up finishes loads a new page, which loses a Take   */
/*  the server does not have yet. While a guard is on, that move waits; once  */
/*  every guard is off (the server has the Take, it was discarded, or the     */
/*  screens closed) the latest one goes. Nothing on screen changes.           */
/* -------------------------------------------------------------------------- */

/** How many guards are on. Each guard counts itself once and its cleanup
 *  takes it off once, so an unmount never leaves one on. */
let guardsOn = 0;
/** The one move that waits: a later tap replaces an earlier one. */
let waiting: (() => void) | null = null;

/** Whether a Take exists only in this tab right now (N553 item 1's window). */
export function takeAtRisk(): boolean {
  return guardsOn > 0;
}

/** Run `go` (a move that loads a new page) now when no Take is at risk;
 *  otherwise once none is, replacing any move already waiting. */
export function whenNoTakeAtRisk(go: () => void): void {
  if (takeAtRisk()) {
    waiting = go;
    return;
  }
  waiting = null;
  go();
}

function guardOff(): void {
  guardsOn = Math.max(0, guardsOn - 1);
  if (guardsOn > 0 || !waiting) return;
  // After this commit, not inside it: the discard or the server's answer
  // finishes its own work first (the Take's copy on the device is settled),
  // and a guard that came straight back on keeps the move waiting.
  setTimeout(() => {
    const go = waiting;
    if (!go || takeAtRisk()) return;
    waiting = null;
    go();
  }, 0);
}

/** Ask before the page unloads while `active`; never otherwise. Unmounting
 *  always takes the listener away. While on, a tap's move waits
 *  (`whenNoTakeAtRisk`). */
export function useLeaveGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers ask only when this is set. Empty: no words of ours.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    guardsOn += 1;
    return () => {
      window.removeEventListener("beforeunload", ask);
      guardOff();
    };
  }, [active]);
}

/** Whether the server's answer says it now has the Take: a 201 (the readout,
 *  or the first Take's Ideal Text it could not confirm) or a 202 (accepted,
 *  finished on the server; a duplicate, or a timeout that names the Take,
 *  maps here too). Every other answer, a 504 that names no Take included,
 *  leaves the Take only in this tab. */
export function serverHasTake(result: LabUploadResult): boolean {
  return (
    result.kind === "ok" ||
    result.kind === "processing" ||
    result.kind === "ideal_text_unconfirmed"
  );
}

/** The window N553 item 1 covers: the Take exists only in this tab's memory.
 *  `blob` is the Take the upload sends; `heldBlob` the last one the server
 *  answered that it has (`serverHasTake`). */
export function takeNotYetAccepted({
  state,
  micStatus,
  blob,
  heldBlob,
}: {
  state: WillabState;
  micStatus: DualCaptureState["status"];
  blob: Blob | null;
  heldBlob: Blob | null;
}): boolean {
  // Recording; paused by a call (N437: the recorder pauses, the mic stays
  // "recording"); finishing (Finish tapped, the last audio being collected).
  if (micStatus === "recording") return true;
  // Finished: the one render before the Take is handed to the upload.
  if (state === "lab_recording") return micStatus === "stopped";
  // Going up, or failed going up, until the server has it. A file picked
  // from the device was never recorded here and is still on the device.
  if (state !== "lab_processing" || !blob || isFile(blob)) return false;
  return blob !== heldBlob;
}

function isFile(blob: Blob): boolean {
  return typeof File !== "undefined" && blob instanceof File;
}
