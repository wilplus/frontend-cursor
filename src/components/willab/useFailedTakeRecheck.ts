"use client";

import { useEffect, useRef } from "react";
import {
  fetchGuestLabReadout,
  type LabReadoutReread,
} from "@/services/api/labRecording";

/* -------------------------------------------------------------------------- */
/*  useFailedTakeRecheck — a failed note must not outlive the failure.         */
/*                                                                            */
/*  FOUNDER, 2026-09-21: "That take didn't go through" in red under a Take    */
/*  whose job had COMPLETED nine minutes earlier. What happened: the worker   */
/*  was redeployed mid-job, the page's wait ran out, and the settle hook      */
/*  marked the take failed (#421, W6: the note stays until the speaker acts). */
/*  Then the queue sweep requeued the job and it finished — server-side, with */
/*  nobody watching. The page kept saying failed because nothing ever asked   */
/*  the server again.                                                         */
/*                                                                            */
/*  W6 stands: a failed note is never cleared by time or by an idle state     */
/*  flip. It is cleared by EVIDENCE — the server saying the take is ready —   */
/*  which is a stronger reason than a tap. So while a failed note is on       */
/*  screen, ask the readout once now, again whenever the tab comes back, and  */
/*  every half minute in between; hand the caller a verdict and let it decide.*/
/*                                                                            */
/*  Plumbing state only crosses this seam (AC-9): the readout's `state`, and   */
/*  whether it carries any content. No score is read, none is surfaced.       */
/* -------------------------------------------------------------------------- */

export type FailedTakeVerdict =
  /** The server says the take is done: the note was stale. */
  | "recovered"
  /** The server says it is processing again (the sweep requeued it). */
  | "running"
  /** The server agrees it failed. The note is honest; keep it. */
  | "still_failed"
  /** Nothing usable came back (network, 401, an unknown state). Keep it. */
  | "unknown";

const DONE_STATES: ReadonlySet<string> = new Set([
  "ready",
  "readout_ready",
  "review_pending",
  "insights_ready",
]);
const FAILED_STATES: ReadonlySet<string> = new Set([
  "failed",
  "failed_ideal_text_unconfirmed",
]);

/** The pure read of one readout answer. Same content rule the resume watch
 *  in the Lounge uses for "this take is done", so the two cannot disagree. */
export function recheckVerdict(
  r: LabReadoutReread | null,
): FailedTakeVerdict {
  if (!r || !r.state) return "unknown";
  if (FAILED_STATES.has(r.state)) return "still_failed";
  if (r.state === "processing") return "running";
  if (DONE_STATES.has(r.state)) return "recovered";
  const hasContent =
    r.readout.snippets.length > 0 ||
    r.readout.instantChunks.length > 0 ||
    r.readout.fullTranscriptChunks.length > 0;
  return hasContent ? "recovered" : "unknown";
}

export const FAILED_TAKE_RECHECK_MS = 30_000;

/** Ask the server what it thinks of this take, once.
 *
 *  FOUNDER 2026-09-24: "Ideal text generation fails!" — with the ready v1.0
 *  card and "we couldn't create your Ideal Text" in the same thread. The
 *  document phase has its own 120s cap, and when it expired the browser wrote
 *  the failure card straight into the Lounge WITHOUT EVER ASKING THE SERVER.
 *  Two independent 120-second timers, one of them running in a tab, both
 *  entitled to declare the same document lost.
 *
 *  A cap releasing the screen is a fact about this tab. A card in the durable
 *  thread is a claim about the take, and this is how that claim gets checked
 *  before it is made. Same pure verdict the recheck above uses, so the two
 *  cannot disagree. */
export async function probeTakeVerdict(
  sessionId: string,
): Promise<FailedTakeVerdict> {
  try {
    return recheckVerdict(await fetchGuestLabReadout(sessionId));
  } catch {
    return "unknown";
  }
}

export function useFailedTakeRecheck(args: {
  /** The failed take's session while its note is on screen; null otherwise. */
  sessionId: string | null;
  onVerdict: (sessionId: string, verdict: FailedTakeVerdict) => void;
}): void {
  const { sessionId } = args;
  // The caller's handler may be a fresh closure each render; holding it in a
  // ref keeps the effect keyed on the session alone.
  const onVerdictRef = useRef(args.onVerdict);
  onVerdictRef.current = args.onVerdict;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let inFlight = false;
    const probe = async () => {
      if (inFlight) return;
      inFlight = true;
      const verdict = recheckVerdict(await fetchGuestLabReadout(sessionId));
      inFlight = false;
      if (cancelled) return;
      onVerdictRef.current(sessionId, verdict);
    };
    void probe();
    // A phone that was locked, a tab that was behind another: the moment the
    // speaker looks again is the moment the note must be true.
    const onWake = () => {
      if (document.visibilityState === "visible") void probe();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    const id = window.setInterval(() => void probe(), FAILED_TAKE_RECHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [sessionId]);
}
