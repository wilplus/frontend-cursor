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
}) {
  const mic = useDualCaptureMic({ transcript: false });
  const [phase, setPhase] = useState<"idle" | "sending" | "failed">("idle");
  // Per-blob latch (same rule as the delivery re-record): upload each recorded
  // blob exactly once, whatever re-renders happen around us.
  const sentBlobRef = useRef<Blob | null>(null);
  const sendingRef = useRef(false);
  const st = mic.state;

  const readPossible = !rereadDone && latestTakeSessionId !== null;

  useEffect(() => {
    if (!readPossible || st.status !== "stopped" || sendingRef.current) return;
    const blob = st.audioBlob;
    if (!blob || blob.size === 0) {
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
        setPhase("idle");
        onReadUploaded();
      } else {
        setPhase("failed");
      }
    });
  }, [st, readPossible, latestTakeSessionId, title, version, onReadUploaded]);

  // State 2 — a fresh spoken take (also the fallback when no pairing target
  // exists, since a read without a pair is invisible on every surface).
  if (!readPossible) {
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
        onClick={() =>
          recording ? void mic.stop() : void mic.start().catch(() => {})
        }
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
          Couldn&apos;t send that reading just now. Give it another go.
        </p>
      ) : recording ? (
        <p className="text-[12px] text-muted-foreground">
          Recording. Read the text above, then tap to send.
        </p>
      ) : null}
    </div>
  );
}
