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

/** Ask before the page unloads while `active`; never otherwise. Unmounting
 *  always takes the listener away. */
export function useLeaveGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers ask only when this is set. Empty: no words of ours.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
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
