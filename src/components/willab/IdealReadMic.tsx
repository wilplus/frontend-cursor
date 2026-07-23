"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";

/* -------------------------------------------------------------------------- */
/*  IdealReadMic — the ONE two-state mic on the ideal-text screen (FE-D)       */
/*                                                                            */
/*  State 1 (reread_done false): tap → record IN PLACE instantly (the text     */
/*  stays on screen, scrollable), tap again → stop → upload as a READ of the   */
/*  ideal text: recording_kind "read", paired to the latest SPOKEN take        */
/*  (REQUIRED — a read without a pair is invisible on every surface), tagged   */
/*  read_target "ideal_text" + ideal_version so the BE flips reread_done.      */
/*                                                                            */
/*  State 2 (reread_done true): the same button reads "Record another take"    */
/*  and redirects to the regular recording screen. That take produces a new    */
/*  ideal-text version, so reread_done resets server-side and the button       */
/*  returns to State 1 for the fresh text.                                     */
/*                                                                            */
/*  State comes from the GET's reread_done — never local — so it survives      */
/*  reload and device switch. Without a pairing target the read is impossible  */
/*  and the button falls back to State 2.                                      */
/* -------------------------------------------------------------------------- */

export default function IdealReadMic({
  arcId,
  version,
  title,
  latestTakeSessionId,
  rereadDone,
  onNewTake,
  onReadUploaded,
  micOnly = false,
}: {
  arcId: string;
  version: number | null;
  /** The latest take's topic (the GET's `title`) — the read upload needs a
   *  topic; falls back to a neutral one. */
  title: string | null;
  latestTakeSessionId: string | null;
  rereadDone: boolean;
  /** State 2 — route into the regular recording screen (a spoken take). */
  onNewTake: () => void;
  /** Fires after a read upload is ACCEPTED — the host refetches the GET so
   *  reread_done flips this button to State 2. */
  onReadUploaded: () => void;
  /** MASTER DOCUMENT (FE-3) — the three-button layout owns "record the next
   *  take" as its own button, so this component renders the READ mic only.
   *  When a read is impossible it renders nothing at all. */
  micOnly?: boolean;
}) {
  const mic = useDualCaptureMic({ transcript: false });
  const [phase, setPhase] = useState<"idle" | "sending" | "failed">("idle");
  // FE-1 — the BE's reason when it refuses the read (422: a read needs its
  // paired take). Shown instead of the generic retry line, because retrying
  // an unpaired read can never succeed.
  const [rejected, setRejected] = useState<string | null>(null);
  // Per-blob latch (same rule as the delivery re-record): upload each recorded
  // blob exactly once, whatever re-renders happen around us.
  const sentBlobRef = useRef<Blob | null>(null);
  const sendingRef = useRef(false);
  const st = mic.state;

  // FE-1 (founder 2026-07-22) — a re-read this session was accepted and is
  // still being analysed until the server confirms it FINISHED (rereadDone,
  // which the BE gates on analysis_state == ready). While that is pending the
  // next-take button must NOT show; a loading line stands in its place, and
  // the button appears only once the analysis is genuinely done.
  //
  // This latch is OWNED HERE, keyed to THIS component's own upload — the
  // earlier attempt read the INITIAL take's poll/marker, which is null on the
  // readout during a re-read (so it never fired) and could go stale (so it
  // over-suppressed). Local + version-scoped avoids both (review R-rr1/R-rr2).
  const [readSubmitted, setReadSubmitted] = useState(false);
  // A new version is a fresh document with no re-read of its own yet.
  useEffect(() => {
    setReadSubmitted(false);
  }, [version]);
  // Pending only while the server has NOT yet flipped rereadDone true. The
  // moment it does (analysis ready), this falls false and the button reveals.
  const readProcessing = readSubmitted && !rereadDone;

  // Poll for completion: the button waits for "finished", not "submitted", so
  // refetch the SD GET on a cadence until rereadDone flips. Fail-open after a
  // cap so a stuck analysis can't trap the user (Guard A still prevents any
  // orphaned mic); after the cap the read mic simply returns, letting them
  // read again. The callback rides a ref so the effect depends ONLY on
  // readProcessing — otherwise the host's inline onReadUploaded would give a
  // fresh identity each render and every refetch-driven re-render would reset
  // the interval (the 3s tick would never land and the cap never accrue).
  const onReadUploadedRef = useRef(onReadUploaded);
  onReadUploadedRef.current = onReadUploaded;
  useEffect(() => {
    if (!readProcessing) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt > 180_000) {
        setReadSubmitted(false);
        return;
      }
      onReadUploadedRef.current(); // the host's SD refetch trigger
    }, 3000);
    return () => clearInterval(id);
  }, [readProcessing]);

  const readPossible = !rereadDone && latestTakeSessionId !== null;

  useEffect(() => {
    if (!readPossible || st.status !== "stopped" || sendingRef.current) return;
    const blob = st.audioBlob;
    if (!blob || blob.size === 0) {
      // A local mic failure is not the previous upload's rejection reason.
      setRejected(null);
      setPhase("failed");
      return;
    }
    if (sentBlobRef.current === blob) return;
    sendingRef.current = true;
    sentBlobRef.current = blob;
    setPhase("sending");
    void submitLabRecording({
      audioBlob: blob,
      durationSec: st.durationSec,
      topic: title ?? "Ideal text read",
      recordingKind: "read",
      // REQUIRED — reads only ever fold under their paired spoken take.
      pairedSessionId: latestTakeSessionId,
      // A read is its own session; never overwrite the spoken take. The id is
      // REQUIRED on a read, so fall back to the repo's Date.now()+random id
      // convention when crypto.randomUUID is unavailable (older Safari).
      guestSessionId:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `read-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      // What the read is OF + which version — flips the GET's reread_done.
      readTarget: "ideal_text",
      idealVersion: version ?? undefined,
    }).then((r) => {
      sendingRef.current = false;
      if (r.kind === "ok" || r.kind === "processing") {
        setRejected(null);
        setPhase("idle");
        // The read is in — now WAIT for its analysis to finish before offering
        // the next take. The poll effect drives refetches until rereadDone.
        setReadSubmitted(true);
        onReadUploaded();
      } else {
        // 422 = the BE (or the FE's own guard) refuses this read; its message
        // is the honest one. Any other failure keeps the retry line.
        setRejected(r.kind === "rejected" ? r.message : null);
        setPhase("failed");
      }
    });
  }, [st, readPossible, latestTakeSessionId, title, version, onReadUploaded]);

  // FE-1 — the button reads STRICTLY from the server (rereadDone + this local
  // submission latch); there is NO optimistic flip. While the just-submitted
  // re-read is still analysing, a loading line stands where the next-take
  // button will be — it appears only once the analysis is genuinely finished.
  // (The BE gates rereadDone on analysis_state == ready; the LabOverlay Guard A
  // is the independent safety net against an orphaned mic.)
  if (readProcessing) {
    return (
      <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Finishing up your reading…
        </div>
      </div>
    );
  }

  // State 2 — a fresh spoken take (also the fallback when no pairing target
  // exists, since a read without a pair is invisible on every surface).
  if (!readPossible) {
    // The three-button layout renders its own "next take" button; here a
    // read that cannot happen simply draws nothing.
    if (micOnly) return null;
    return (
      <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
        <Button
          type="button"
          onClick={onNewTake}
          variant="outline"
          className="h-10 rounded-full px-5 text-[14px] font-medium"
        >
          <Mic className="mr-2 h-4 w-4" aria-hidden />
          Record another take
        </Button>
      </div>
    );
  }

  const recording = st.status === "recording";
  return (
    <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
      <Button
        type="button"
        onClick={() => {
          if (recording) {
            void mic.stop();
            return;
          }
          // A fresh attempt starts clean — no stale failure line hanging over
          // the new recording.
          setRejected(null);
          setPhase("idle");
          void mic.start().catch(() => {});
        }}
        disabled={phase === "sending"}
        variant={recording ? "default" : "outline"}
        className={`h-10 rounded-full px-5 text-[14px] font-medium ${
          recording
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : ""
        }`}
      >
        {phase === "sending" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : recording ? (
          <>
            {/* mic-on indicator — a small pulsing dot beside the stop glyph */}
            <span
              className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-destructive-foreground"
              aria-hidden
            />
            <Square className="mr-2 h-3.5 w-3.5" aria-hidden />
            Stop and send
          </>
        ) : (
          <>
            <Mic className="mr-2 h-4 w-4" aria-hidden />
            Read it aloud
          </>
        )}
      </Button>
      {phase === "failed" ? (
        <p className="text-[12px] text-muted-foreground">
          {rejected ??
            "Couldn't send that reading just now. Give it another go."}
        </p>
      ) : recording ? (
        <p className="text-[12px] text-muted-foreground">
          Recording. Read the text above, then tap to send.
        </p>
      ) : null}
    </div>
  );
}
