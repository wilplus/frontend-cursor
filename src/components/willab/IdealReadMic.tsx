"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { VoiceMark } from "./LoadingState";
import { Button } from "@/components/ui/button";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

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
  rereadProcessing = null,
  canRecordTake = null,
  onNewTake,
  onReadUploaded,
  micOnly = false,
  onBusyChange,
}: {
  arcId: string;
  version: number | null;
  /** The latest take's topic (the GET's `title`) — the read upload needs a
   *  topic; falls back to a neutral one. */
  title: string | null;
  latestTakeSessionId: string | null;
  rereadDone: boolean;
  /** §4 — the BE's authoritative "a re-read of this version is still being
   *  analysed" signal. Preferred over the local latch (it survives a reload /
   *  device switch); null → the FE falls back to the latch. */
  rereadProcessing?: boolean | null;
  /** The BE's gate on recording a new OFFICIAL take. Gates ONLY on an
   *  explicit false: null / absent (older payload, flag off) never hides or
   *  disables anything, because a live recording affordance must not go dark
   *  behind a field the deploy may not send. The read mic is deliberately
   *  untouched by this: a re-read is not an official take. */
  canRecordTake?: boolean | null;
  /** State 2 — route into the regular recording screen (a spoken take). */
  onNewTake: () => void;
  /** Fires after a read upload is ACCEPTED — the host refetches the GET so
   *  reread_done flips this button to State 2. */
  onReadUploaded: () => void;
  /** MASTER DOCUMENT (FE-3) — the three-button layout owns "record the next
   *  take" as its own button, so this component renders the READ mic only.
   *  When a read is impossible it renders nothing at all. */
  micOnly?: boolean;
  /** Founder 2026-07-30 — true while a reading is live or still being
   *  analysed. This component already withholds its OWN next-take button for
   *  exactly that span; the three-button layout owns a second one and had no
   *  way to know, so it offered "record the next take" over a hot mic and
   *  through the whole analysis. Reported rather than recomputed: the answer
   *  depends on local latches (the submission latch, the fail-open cap) that
   *  only exist here, and a second derivation of it would drift. */
  onBusyChange?: (busy: boolean) => void;
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
  // Founder 2026-07-30 (the "lag" bug) — a read attempt is LOCKED IN from the
  // tap on "Read it aloud" until its upload settles. Background refetches keep
  // landing while the user reads (a PREVIOUS read finishing its analysis flips
  // reread_processing / rereadDone mid-recording), and before this latch those
  // flips re-rendered the component into the loading line and then the
  // next-take button WHILE THE MIC KEPT RECORDING invisibly — the orphaned
  // stream then made the Lab's own getUserMedia hang on "Getting your mic
  // ready…". The latch (a) keeps the live recording UI on screen no matter
  // what the server reports about older reads, and (b) pins the pairing target
  // + version the upload uses to the ones in force when the read STARTED, so a
  // mid-read flip can't drop the send.
  const [activeRead, setActiveRead] = useState(false);
  const readTargetRef = useRef<{
    pairSessionId: string;
    version: number | null;
  } | null>(null);

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
  // FE-1 fail-open (review R-rr3): once the poll below waits out its cap we
  // STOP waiting and release the loading state EVEN IF the server is still
  // serving reread_processing=true (a stuck / slow analysis — the exact case
  // the cap exists for). Without this latch the `rereadProcessing === true`
  // disjunct in `readProcessing` re-holds the loading line forever after the
  // cap, trapping the user on "Finishing up your reading…". Reset whenever a
  // fresh wait begins: a new version, or a new re-read upload this session.
  const [cappedOut, setCappedOut] = useState(false);
  // A new version is a fresh document with no re-read of its own yet.
  useEffect(() => {
    setReadSubmitted(false);
    setCappedOut(false);
  }, [version]);
  // Pending only while the server has NOT yet flipped rereadDone true. The
  // BE's `reread_processing` is authoritative (survives reload/device); the
  // local latch is the fallback for a payload that predates the field OR the
  // brief window before the first refetch lands. Either way it clears the
  // instant rereadDone flips.
  const readProcessing =
    !rereadDone && !cappedOut && (rereadProcessing === true || readSubmitted);

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
        // Genuine fail-open: force the loading state off regardless of what the
        // server still reports, then stop polling. `cappedOut` (not merely
        // clearing the local latch) is what releases the server-held case where
        // reread_processing stays true — otherwise readProcessing re-latches and
        // this branch fires forever without ever refetching again.
        setReadSubmitted(false);
        setCappedOut(true);
        return;
      }
      onReadUploadedRef.current(); // the host's SD refetch trigger
    }, 3000);
    return () => clearInterval(id);
  }, [readProcessing]);

  const readPossible = !rereadDone && latestTakeSessionId !== null;

  useEffect(() => {
    // Gate on the LATCHED read, not the live props: the props may have flipped
    // (an older read's analysis finishing) while this one was being recorded,
    // and that must not drop the send.
    const target = readTargetRef.current;
    if (!target || st.status !== "stopped" || sendingRef.current) return;
    const blob = st.audioBlob;
    if (!blob || blob.size === 0) {
      // A local mic failure is not the previous upload's rejection reason.
      setRejected(null);
      setPhase("failed");
      setActiveRead(false);
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
      // REQUIRED — reads only ever fold under their paired spoken take,
      // pinned at recording start.
      pairedSessionId: target.pairSessionId,
      // A read is its own session; never overwrite the spoken take. The id is
      // REQUIRED on a read, so fall back to the repo's Date.now()+random id
      // convention when crypto.randomUUID is unavailable (older Safari).
      guestSessionId:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `read-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      // What the read is OF + which version — flips the GET's reread_done.
      // Pinned at recording start (a mid-read version bump must not relabel it).
      readTarget: "ideal_text",
      idealVersion: target.version ?? undefined,
    }).then((r) => {
      sendingRef.current = false;
      setActiveRead(false);
      readTargetRef.current = null;
      if (r.kind === "ok" || r.kind === "processing") {
        setRejected(null);
        setPhase("idle");
        // The read is in — now WAIT for its analysis to finish before offering
        // the next take. The poll effect drives refetches until rereadDone. A
        // fresh upload begins a NEW wait, so clear any prior fail-open cap.
        setCappedOut(false);
        setReadSubmitted(true);
        onReadUploaded();
      } else {
        // 422 = the BE (or the FE's own guard) refuses this read; its message
        // is the honest one. Any other failure keeps the retry line.
        setRejected(r.kind === "rejected" ? r.message : null);
        setPhase("failed");
      }
    });
  }, [st, title, onReadUploaded]);

  // A mic error ends the attempt — release the latch so the server-driven
  // branches below can take over again.
  useEffect(() => {
    if (st.status === "error" && activeRead) {
      setActiveRead(false);
      readTargetRef.current = null;
    }
  }, [st.status, activeRead]);

  // Founder 2026-07-30 — while a read attempt is live (recording, stopped
  // pending its send, or sending) the mic UI OWNS this slot: no background
  // refetch may replace it with the loading line or the next-take button while
  // the mic is hot. That swap is exactly what orphaned the stream and made the
  // Lab's own mic hang afterwards.
  const readingNow =
    activeRead || st.status === "recording" || phase === "sending";

  // Tell the host, so a sibling next-take button can withhold itself over the
  // same span this component withholds its own. Through a ref so an inline
  // host callback cannot re-fire the effect every render.
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  const readBusy = readingNow || readProcessing;
  useEffect(() => {
    onBusyChangeRef.current?.(readBusy);
  }, [readBusy]);
  // Unmounting mid-read (a version bump swaps the layout) must not leave the
  // host latched busy forever with no component to clear it.
  useEffect(
    () => () => {
      onBusyChangeRef.current?.(false);
    },
    []
  );

  // FE-1 — the button reads STRICTLY from the server (rereadDone + this local
  // submission latch); there is NO optimistic flip. While the just-submitted
  // re-read is still analysing, a loading line stands where the next-take
  // button will be — it appears only once the analysis is genuinely finished.
  // (The BE gates rereadDone on analysis_state == ready; the LabOverlay Guard A
  // is the independent safety net against an orphaned mic.)
  if (!readingNow && readProcessing) {
    return (
      <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <VoiceMark size={20} />
          Finishing up your reading…
        </div>
      </div>
    );
  }

  // State 2 — a fresh spoken take (also the fallback when no pairing target
  // exists, since a read without a pair is invisible on every surface).
  if (!readingNow && !readPossible) {
    // The three-button layout renders its own "next take" button; here a
    // read that cannot happen simply draws nothing.
    if (micOnly) return null;
    return (
      <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
        <Button
          type="button"
          onClick={onNewTake}
          disabled={canRecordTake === false}
          variant="outline"
          className="h-10 rounded-full px-5 text-[14px] font-medium"
        >
          {/* MASTER DOCUMENT (founder 2026-07-23) — the RED recording dot: this
              is an OFFICIAL take, not a re-read. onNewTake drops straight into
              the recorder with this project's setup (deck/timer/audience)
              already loaded, and the take appends to this project
              (continue_arc_id) so its number climbs — never a bounce back to
              the chat's global record entry. */}
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500"
            aria-hidden
          />
          Record another take
        </Button>
        {canRecordTake === false ? (
          <p className="text-[12px] text-muted-foreground">
            {IDEAL_EDIT_COPY.recordUnavailable}
          </p>
        ) : null}
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
          // the new recording. Pin the pairing target + version NOW: the
          // upload must use what was true when the read started, whatever a
          // background refetch flips mid-read.
          setRejected(null);
          setPhase("idle");
          if (latestTakeSessionId === null) return;
          readTargetRef.current = {
            pairSessionId: latestTakeSessionId,
            version,
          };
          setActiveRead(true);
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
